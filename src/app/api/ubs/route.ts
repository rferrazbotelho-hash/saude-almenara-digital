import { NextResponse, connection } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  await connection();
  try {
    const db = getDb();
    const ubs = db.prepare("SELECT * FROM ubs ORDER BY zone DESC, name ASC").all();
    const patients = db.prepare("SELECT * FROM patients ORDER BY name ASC").all();
    return NextResponse.json({ ubs, patients });
  } catch (error) {
    console.error("GET /api/ubs error:", error);
    return NextResponse.json({ error: "Erro ao carregar unidades de saúde." }, { status: 500 });
  }
}
