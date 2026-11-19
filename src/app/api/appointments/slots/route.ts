import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { TIME_SLOTS } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ubsId = searchParams.get("ubsId");
    const date = searchParams.get("date");

    if (!ubsId || !date) {
      return NextResponse.json(
        { error: "Parâmetros ubsId e date são obrigatórios." },
        { status: 400 }
      );
    }

    const db = getDb();
    const occupiedRows = db
      .prepare(
        `SELECT time FROM appointments
         WHERE ubs_id = ? AND date = ? AND status != 'Cancelado'`
      )
      .all(ubsId, date) as Array<{ time: string }>;

    const occupiedSet = new Set(occupiedRows.map((r) => r.time));
    const slots = TIME_SLOTS.map((time) => ({
      time,
      available: !occupiedSet.has(time),
    }));

    return NextResponse.json({ ubsId, date, slots });
  } catch (error) {
    console.error("GET /api/appointments/slots error:", error);
    return NextResponse.json({ error: "Erro ao consultar horários." }, { status: 500 });
  }
}
