import { NextRequest, NextResponse } from "next/server";
import { getClientIp, getDb, recordAuditLog } from "@/lib/db";
import { buildMeuSusVaccines, deriveCnsFromCpf } from "@/lib/meusus";

function maskCpf(digits: string): string {
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      cpf,
      password,
      address,
      latitude,
      longitude,
      ubsId,
      cns,
      whatsapp,
      emergencyContactName,
      emergencyContactPhone,
    } = body as {
      name?: string;
      cpf?: string;
      password?: string;
      address?: string;
      latitude?: number | null;
      longitude?: number | null;
      ubsId?: string;
      cns?: string;
      whatsapp?: string;
      emergencyContactName?: string;
      emergencyContactPhone?: string;
    };

    const cpfDigits = (cpf || "").replace(/\D/g, "");
    if (
      !name?.trim() ||
      cpfDigits.length !== 11 ||
      !password ||
      password.length < 4 ||
      !address?.trim() ||
      !whatsapp?.trim() ||
      !emergencyContactName?.trim() ||
      !emergencyContactPhone?.trim()
    ) {
      return NextResponse.json(
        {
          error:
            "Preencha todos os campos obrigatórios: Nome, CPF (11 dígitos), Senha, Endereço, WhatsApp e Contato de Emergência.",
        },
        { status: 400 }
      );
    }

    const db = getDb();
    const existing = db
      .prepare("SELECT id FROM users WHERE cpf_digits = ?")
      .get(cpfDigits);

    if (existing) {
      return NextResponse.json(
        { error: "Este CPF já está cadastrado no Saúde Almenara Digital. Utilize a aba Entrar." },
        { status: 409 }
      );
    }

    const cpfMasked = maskCpf(cpfDigits);
    const effectiveCns = cns?.trim() || deriveCnsFromCpf(cpfDigits);
    const effectiveUbsId = ubsId || "ubs-centro";
    const nowIso = new Date().toISOString();
    const patientId = `pat-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const userId = `usr-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;

    db.prepare(
      `INSERT INTO patients (
        id, name, cpf_masked, cns, birth_date, ubs_id,
        address, whatsapp, emergency_contact_name, emergency_contact_phone, cns_synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      patientId,
      name.trim(),
      cpfMasked,
      effectiveCns,
      "1985-01-01",
      effectiveUbsId,
      address.trim(),
      whatsapp.trim(),
      emergencyContactName.trim(),
      emergencyContactPhone.trim(),
      nowIso
    );

    // Popula cartão de vacinas inicial integrado ao Meu SUS Digital
    const ubsRow = db
      .prepare("SELECT name FROM ubs WHERE id = ?")
      .get(effectiveUbsId) as { name: string } | undefined;
    const vacs = buildMeuSusVaccines(
      cpfDigits,
      ubsRow ? `${ubsRow.name} - Almenara/MG` : "UBS Centro - Almenara/MG"
    );
    const insertVac = db.prepare(`
      INSERT INTO vaccines (
        id, patient_id, vaccine_name, dose, batch, manufacturer,
        date_applied, ubs_name, professional, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    vacs.forEach((v, idx) => {
      insertVac.run(
        `vac-${patientId}-${idx + 1}`,
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

    db.prepare(
      `INSERT INTO users (
        id, name, cpf_digits, cpf_masked, password, role, cns, ubs_id,
        patient_id, address, latitude, longitude, whatsapp,
        emergency_contact_name, emergency_contact_phone, created_at
      ) VALUES (?, ?, ?, ?, ?, 'cidadao', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      userId,
      name.trim(),
      cpfDigits,
      cpfMasked,
      password,
      effectiveCns,
      effectiveUbsId,
      patientId,
      address.trim(),
      latitude ?? null,
      longitude ?? null,
      whatsapp.trim(),
      emergencyContactName.trim(),
      emergencyContactPhone.trim(),
      nowIso
    );

    recordAuditLog({
      userName: name.trim(),
      userRole: "Cidadão (Munícipe)",
      action: "CADASTRO_CIDADAO_SUS",
      details: `Novo cadastro realizado (CPF ${cpfMasked} • CNS ${effectiveCns} • WhatsApp ${whatsapp.trim()})`,
      ipAddress: getClientIp(request.headers),
    });

    return NextResponse.json(
      {
        user: {
          id: userId,
          name: name.trim(),
          cpf_masked: cpfMasked,
          role: "cidadao",
          cns: effectiveCns,
          ubs_id: effectiveUbsId,
          patient_id: patientId,
          address: address.trim(),
          whatsapp: whatsapp.trim(),
          emergency_contact_name: emergencyContactName.trim(),
          emergency_contact_phone: emergencyContactPhone.trim(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/auth/register error:", error);
    return NextResponse.json({ error: "Erro ao realizar cadastro." }, { status: 500 });
  }
}
