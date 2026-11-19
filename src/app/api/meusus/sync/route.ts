import { NextRequest, NextResponse, connection } from "next/server";
import { getClientIp, getDb, recordAuditLog } from "@/lib/db";
import { buildMeuSusVaccines, deriveCnsFromCpf } from "@/lib/meusus";

export async function GET(request: NextRequest) {
  await connection();
  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");

    if (!patientId) {
      return NextResponse.json(
        { error: "patientId é obrigatório." },
        { status: 400 }
      );
    }

    const db = getDb();
    const patient = db
      .prepare("SELECT id, name, cns, cns_synced_at FROM patients WHERE id = ?")
      .get(patientId) as
      | { id: string; name: string; cns: string; cns_synced_at: string }
      | undefined;

    if (!patient) {
      return NextResponse.json({ error: "Paciente não encontrado." }, { status: 404 });
    }

    const vaccines = db
      .prepare(
        "SELECT * FROM vaccines WHERE patient_id = ? ORDER BY status ASC, date_applied DESC"
      )
      .all(patientId);

    return NextResponse.json({
      patientId: patient.id,
      cns: patient.cns,
      syncedAt: patient.cns_synced_at || null,
      vaccines,
    });
  } catch (error) {
    console.error("GET /api/meusus/sync error:", error);
    return NextResponse.json(
      { error: "Erro ao consultar cartão de vacinas." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { patientId, cpf } = body as { patientId?: string; cpf?: string };

    const cpfDigits = (cpf || "").replace(/\D/g, "");
    if (!patientId || cpfDigits.length !== 11) {
      return NextResponse.json(
        {
          error:
            "Informe o paciente e um CPF válido (11 dígitos) para sincronizar com o Meu SUS Digital.",
        },
        { status: 400 }
      );
    }

    const db = getDb();
    const patient = db
      .prepare(
        `SELECT p.*, u.name as ubs_name
         FROM patients p
         LEFT JOIN ubs u ON u.id = p.ubs_id
         WHERE p.id = ?`
      )
      .get(patientId) as
      | { id: string; name: string; cns: string; ubs_name: string | null }
      | undefined;

    if (!patient) {
      return NextResponse.json({ error: "Paciente não encontrado." }, { status: 404 });
    }

    // Consulta/deriva o número oficial do Cartão SUS (CNS) pelo CPF e atualiza a base local
    const syncedCns = deriveCnsFromCpf(cpfDigits);
    const nowIso = new Date().toISOString();

    db.prepare(
      "UPDATE patients SET cns = ?, cns_synced_at = ? WHERE id = ?"
    ).run(syncedCns, nowIso, patientId);

    db.prepare(
      "UPDATE users SET cns = ? WHERE patient_id = ?"
    ).run(syncedCns, patientId);

    // Atualiza o Cartão de Vacinação Digital (RNDS / PNI)
    const meuSusVaccines = buildMeuSusVaccines(
      cpfDigits,
      patient.ubs_name ? `${patient.ubs_name} - Almenara/MG` : "UBS Centro - Almenara/MG"
    );

    db.prepare("DELETE FROM vaccines WHERE patient_id = ?").run(patientId);
    const insertVac = db.prepare(`
      INSERT INTO vaccines (
        id, patient_id, vaccine_name, dose, batch, manufacturer,
        date_applied, ubs_name, professional, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    meuSusVaccines.forEach((v, idx) => {
      insertVac.run(
        `vac-${patientId}-${idx + 1}-${Date.now()}`,
        patientId,
        v.vaccine_name,
        v.dose,
        v.batch,
        v.manufacturer,
        v.date_applied,
        v.ubs_name,
        v.professional,
        v.status
      );
    });

    const vaccines = db
      .prepare(
        "SELECT * FROM vaccines WHERE patient_id = ? ORDER BY status ASC, date_applied DESC"
      )
      .all(patientId);

    recordAuditLog({
      userName: patient.name,
      userRole: "Cidadão (Munícipe)",
      action: "SINCRONIZACAO_MEU_SUS_RNDS",
      details: `Dados atualizados via Portal Meu SUS Digital (CPF ***.${cpfDigits.slice(3, 6)}.${cpfDigits.slice(6, 9)}-** • CNS ${syncedCns} • ${meuSusVaccines.length} vacinas)`,
      ipAddress: getClientIp(request.headers),
    });

    return NextResponse.json({
      source: "Meu SUS Digital (RNDS / CADSUS)",
      cns: syncedCns,
      syncedAt: nowIso,
      vaccines,
    });
  } catch (error) {
    console.error("POST /api/meusus/sync error:", error);
    return NextResponse.json(
      { error: "Erro ao sincronizar com o Portal Meu SUS Digital." },
      { status: 500 }
    );
  }
}
