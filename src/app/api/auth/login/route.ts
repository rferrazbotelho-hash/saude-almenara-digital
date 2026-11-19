import { NextRequest, NextResponse } from "next/server";
import { getClientIp, getDb, recordAuditLog } from "@/lib/db";
import type { UserRole } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cpf, password, role } = body as {
      cpf?: string;
      password?: string;
      role?: UserRole;
    };

    const cpfDigits = (cpf || "").replace(/\D/g, "");
    if (cpfDigits.length !== 11 || !password || !role) {
      return NextResponse.json(
        { error: "Informe o perfil, um CPF válido (11 dígitos) e a senha." },
        { status: 400 }
      );
    }

    const db = getDb();
    const user = db
      .prepare(
        `SELECT id, name, cpf_masked, password, role, cns, ubs_id, patient_id,
                address, whatsapp, emergency_contact_name, emergency_contact_phone
         FROM users
         WHERE cpf_digits = ? AND role = ?
         LIMIT 1`
      )
      .get(cpfDigits, role) as
      | {
          id: string;
          name: string;
          cpf_masked: string;
          password: string;
          role: UserRole;
          cns: string;
          ubs_id: string;
          patient_id: string | null;
          address: string;
          whatsapp: string;
          emergency_contact_name: string;
          emergency_contact_phone: string;
        }
      | undefined;

    if (!user || user.password !== password) {
      return NextResponse.json(
        { error: "CPF, senha ou perfil selecionado inválidos." },
        { status: 401 }
      );
    }

    const roleLabels: Record<UserRole, string> = {
      cidadao: "Cidadão (Munícipe)",
      recepcao: "Recepção / Farmácia",
      gestao: "Gestão Pública (BI)",
    };

    recordAuditLog({
      userName: user.name,
      userRole: roleLabels[user.role],
      action: "LOGIN_SISTEMA",
      details: `Acesso autenticado via CPF (${user.cpf_masked}) no módulo ${roleLabels[user.role]}`,
      ipAddress: getClientIp(request.headers),
    });

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        cpf_masked: user.cpf_masked,
        role: user.role,
        cns: user.cns,
        ubs_id: user.ubs_id,
        patient_id: user.patient_id || undefined,
        address: user.address,
        whatsapp: user.whatsapp,
        emergency_contact_name: user.emergency_contact_name,
        emergency_contact_phone: user.emergency_contact_phone,
      },
    });
  } catch (error) {
    console.error("POST /api/auth/login error:", error);
    return NextResponse.json({ error: "Erro ao autenticar." }, { status: 500 });
  }
}
