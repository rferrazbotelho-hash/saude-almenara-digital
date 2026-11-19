import { NextRequest, NextResponse } from "next/server";
import { getClientIp, getDb, recordAuditLog } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ubsId = searchParams.get("ubsId");
    const date = searchParams.get("date");
    const patientId = searchParams.get("patientId");

    const db = getDb();
    const conditions: string[] = [];
    const params: string[] = [];

    if (ubsId && ubsId !== "all") {
      conditions.push("a.ubs_id = ?");
      params.push(ubsId);
    }
    if (date) {
      conditions.push("a.date = ?");
      params.push(date);
    }
    if (patientId) {
      conditions.push("a.patient_id = ?");
      params.push(patientId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const appointments = db
      .prepare(
        `SELECT a.*, u.name as ubs_name, u.zone as ubs_zone
         FROM appointments a
         JOIN ubs u ON u.id = a.ubs_id
         ${whereClause}
         ORDER BY a.date DESC, a.time ASC`
      )
      .all(...params);

    return NextResponse.json({ appointments });
  } catch (error) {
    console.error("GET /api/appointments error:", error);
    return NextResponse.json({ error: "Erro ao carregar agendamentos." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      patientId,
      patientName,
      patientCns,
      patientCpfMasked,
      ubsId,
      specialty,
      date,
      time,
      isWalkin = false,
      actorName,
      actorRole,
    } = body as {
      patientId?: string;
      patientName?: string;
      patientCns?: string;
      patientCpfMasked?: string;
      ubsId?: string;
      specialty?: string;
      date?: string;
      time?: string;
      isWalkin?: boolean;
      actorName?: string;
      actorRole?: string;
    };

    if (!ubsId || !specialty || !date || !time || !patientName || !patientCns) {
      return NextResponse.json(
        { error: "Campos obrigatórios ausentes para o agendamento." },
        { status: 400 }
      );
    }

    const db = getDb();
    const effectivePatientId = patientId || `walkin-${patientCns.replace(/\s+/g, "")}`;
    const effectiveCpf = patientCpfMasked || "***.000.000-**";

    // Regra de Negócio Crítica: Trava Anti-Duplicidade (intervalo mínimo de 15 dias na mesma especialidade)
    const duplicate = db
      .prepare(
        `SELECT a.id, a.date, a.time, a.status, u.name as ubs_name
         FROM appointments a
         JOIN ubs u ON u.id = a.ubs_id
         WHERE (a.patient_id = ? OR a.patient_cns = ?)
           AND a.specialty = ?
           AND a.status != 'Cancelado'
           AND ABS(julianday(a.date) - julianday(?)) < 15
         ORDER BY a.date DESC
         LIMIT 1`
      )
      .get(effectivePatientId, patientCns, specialty, date) as
      | { id: string; date: string; time: string; status: string; ubs_name: string }
      | undefined;

    if (duplicate) {
      const formattedDate = duplicate.date.split("-").reverse().join("/");
      return NextResponse.json(
        {
          code: "ANTI_DUPLICIDADE_15_DIAS",
          error: `Regra do SUS Municipal: Já existe um agendamento de ${specialty} para este paciente em ${formattedDate} (${duplicate.ubs_name} - Status: ${duplicate.status}). O intervalo mínimo permitido entre consultas da mesma especialidade é de 15 dias.`,
        },
        { status: 409 }
      );
    }

    // Verifica disponibilidade do horário (exceto encaixe presencial)
    if (!isWalkin) {
      const slotTaken = db
        .prepare(
          `SELECT id FROM appointments
           WHERE ubs_id = ? AND date = ? AND time = ? AND status != 'Cancelado'
           LIMIT 1`
        )
        .get(ubsId, date, time);

      if (slotTaken) {
        return NextResponse.json(
          { error: "Este horário acabou de ser reservado. Por favor, escolha outro horário disponível." },
          { status: 409 }
        );
      }
    }

    const id = `apt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const nowIso = new Date().toISOString();
    const initialStatus = isWalkin ? "Confirmado" : "Aguardando";

    db.prepare(
      `INSERT INTO appointments (
        id, patient_id, patient_name, patient_cns, patient_cpf_masked,
        ubs_id, specialty, date, time, status, is_walkin, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      effectivePatientId,
      patientName,
      patientCns,
      effectiveCpf,
      ubsId,
      specialty,
      date,
      time,
      initialStatus,
      isWalkin ? 1 : 0,
      nowIso
    );

    const created = db
      .prepare(
        `SELECT a.*, u.name as ubs_name, u.zone as ubs_zone
         FROM appointments a
         JOIN ubs u ON u.id = a.ubs_id
         WHERE a.id = ?`
      )
      .get(id) as { ubs_name: string };

    recordAuditLog({
      userName: actorName || patientName,
      userRole: actorRole || (isWalkin ? "Recepção / Farmácia" : "Cidadão (Munícipe)"),
      action: isWalkin ? "ENCAIXE_PRESENCIAL" : "NOVO_AGENDAMENTO",
      details: `${patientName} - ${specialty} na ${created.ubs_name} em ${date.split("-").reverse().join("/")} às ${time}`,
      ipAddress: getClientIp(request.headers),
    });

    return NextResponse.json({ appointment: created }, { status: 201 });
  } catch (error) {
    console.error("POST /api/appointments error:", error);
    return NextResponse.json({ error: "Erro ao criar agendamento." }, { status: 500 });
  }
}
