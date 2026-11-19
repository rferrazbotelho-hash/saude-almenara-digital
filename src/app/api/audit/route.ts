import { NextRequest, NextResponse } from "next/server";
import { getClientIp, recordAuditLog } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userName, userRole, action, details } = body as {
      userName?: string;
      userRole?: string;
      action?: string;
      details?: string;
    };

    if (!action || !details) {
      return NextResponse.json({ error: "Dados de auditoria inválidos." }, { status: 400 });
    }

    recordAuditLog({
      userName: userName || "Usuário do Sistema",
      userRole: userRole || "Gestão Pública",
      action,
      details,
      ipAddress: getClientIp(request.headers),
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("POST /api/audit error:", error);
    return NextResponse.json({ error: "Erro ao registrar log de auditoria." }, { status: 500 });
  }
}
