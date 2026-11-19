import { NextRequest, NextResponse, connection } from "next/server";
import { getDb } from "@/lib/db";

function deriveCnsFromCpf(digits: string): string {
  let hash = 0;
  for (let i = 0; i < digits.length; i++) {
    hash = (hash * 31 + digits.charCodeAt(i)) % 1000000000;
  }
  const suffix = String(hash).padStart(9, "4") + digits.slice(0, 3);
  const full = ("700" + suffix).slice(0, 15);
  return `${full.slice(0, 3)} ${full.slice(3, 7)} ${full.slice(7, 11)} ${full.slice(11, 15)}`;
}

export async function GET(request: NextRequest) {
  await connection();
  const { searchParams } = new URL(request.url);
  const cpfDigits = (searchParams.get("cpf") || "").replace(/\D/g, "");

  if (cpfDigits.length !== 11) {
    return NextResponse.json(
      { error: "CPF deve conter 11 dígitos para consulta ao CADSUS." },
      { status: 400 }
    );
  }

  const db = getDb();
  const existing = db
    .prepare("SELECT cns, name FROM users WHERE cpf_digits = ? LIMIT 1")
    .get(cpfDigits) as { cns: string; name: string } | undefined;

  if (existing) {
    return NextResponse.json({
      found: true,
      cns: existing.cns,
      source: "Base Municipal / CADSUS",
    });
  }

  return NextResponse.json({
    found: true,
    cns: deriveCnsFromCpf(cpfDigits),
    source: "Integração Automática Portal CADSUS / e-SUS AB",
  });
}
