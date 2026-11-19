import { NextRequest, NextResponse } from "next/server";
import { getClientIp, getDb, recordAuditLog } from "@/lib/db";

const ALLOWED_STATUSES = new Set([
  "Confirmado",
  "Aguardando",
  "Realizado",
  "Faltou",
  "Cancelado",
]);

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { status, actorName, actorRole } = body as {
      status?: string;
      actorName?: string;
      actorRole?: string;
    };

    if (!status || !ALLOWED_STATUSES.has(status)) {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    }

    const db = getDb();
    const existing = db
      .prepare(
        `SELECT a.*, u.name as ubs_name
         FROM appointments a
         JOIN ubs u ON u.id = a.ubs_id
         WHERE a.id = ?`
      )
      .get(id) as
      | {
          id: string;
          patient_name: string;
          specialty: string;
          date: string;
          time: string;
          ubs_name: string;
          status: string;
        }
      | undefined;

    if (!existing) {
      return NextResponse.json({ error: "Agendamento não encontrado." }, { status: 404 });
    }

    db.prepare("UPDATE appointments SET status = ? WHERE id = ?").run(status, id);

    const updated = db
      .prepare(
        `SELECT a.*, u.name as ubs_name, u.zone as ubs_zone
         FROM appointments a
         JOIN ubs u ON u.id = a.ubs_id
         WHERE a.id = ?`
      )
      .get(id);

    const actionMap: Record<string, string> = {
      Confirmado: "CONFIRMACAO_PRESENCA",
      Realizado: "ATENDIMENTO_REALIZADO",
      Faltou: "REGISTRO_FALTA",
      Cancelado: "CANCELAMENTO_VAGA",
    };

    recordAuditLog({
      userName: actorName || existing.patient_name,
      userRole: actorRole || "Sistema",
      action: actionMap[status] || "ATUALIZACAO_AGENDAMENTO",
      details: `${existing.patient_name} (${existing.specialty} - ${existing.ubs_name}, ${existing.date.split("-").reverse().join("/")} ${existing.time}): ${existing.status} → ${status}`,
      ipAddress: getClientIp(request.headers),
    });

    return NextResponse.json({ appointment: updated });
  } catch (error) {
    console.error("PATCH /api/appointments/[id] error:", error);
    return NextResponse.json({ error: "Erro ao atualizar agendamento." }, { status: 500 });
  }
}
