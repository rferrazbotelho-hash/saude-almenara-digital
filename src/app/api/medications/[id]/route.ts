import { NextRequest, NextResponse } from "next/server";
import { getClientIp, getDb, recordAuditLog } from "@/lib/db";

const ALLOWED_STATUSES = new Set(["Disponível", "Estoque Baixo", "Em Reposição"]);

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
      return NextResponse.json({ error: "Status de estoque inválido." }, { status: 400 });
    }

    const db = getDb();
    const existing = db
      .prepare(
        `SELECT m.*, u.name as ubs_name
         FROM medications m
         JOIN ubs u ON u.id = m.ubs_id
         WHERE m.id = ?`
      )
      .get(id) as
      | { id: string; name: string; ubs_name: string; status: string }
      | undefined;

    if (!existing) {
      return NextResponse.json({ error: "Medicamento não encontrado." }, { status: 404 });
    }

    const nowIso = new Date().toISOString();
    db.prepare("UPDATE medications SET status = ?, updated_at = ? WHERE id = ?").run(
      status,
      nowIso,
      id
    );

    const updated = db
      .prepare(
        `SELECT m.*, u.name as ubs_name
         FROM medications m
         JOIN ubs u ON u.id = m.ubs_id
         WHERE m.id = ?`
      )
      .get(id);

    recordAuditLog({
      userName: actorName || "Farmacêutico(a) Municipal",
      userRole: actorRole || "Recepção / Farmácia",
      action: "ATUALIZACAO_ESTOQUE_REMUME",
      details: `${existing.name} (${existing.ubs_name}): ${existing.status} → ${status}`,
      ipAddress: getClientIp(request.headers),
    });

    return NextResponse.json({ medication: updated });
  } catch (error) {
    console.error("PATCH /api/medications/[id] error:", error);
    return NextResponse.json({ error: "Erro ao atualizar medicamento." }, { status: 500 });
  }
}
