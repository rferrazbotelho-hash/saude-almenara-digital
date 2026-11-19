import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    const ubsId = searchParams.get("ubsId");

    const db = getDb();
    const conditions: string[] = [];
    const params: string[] = [];

    if (ubsId && ubsId !== "all") {
      conditions.push("m.ubs_id = ?");
      params.push(ubsId);
    }

    if (q) {
      conditions.push(
        "(LOWER(m.name) LIKE ? OR LOWER(m.active_ingredient) LIKE ? OR LOWER(u.name) LIKE ?)"
      );
      const pattern = `%${q}%`;
      params.push(pattern, pattern, pattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const medications = db
      .prepare(
        `SELECT m.*, u.name as ubs_name
         FROM medications m
         JOIN ubs u ON u.id = m.ubs_id
         ${whereClause}
         ORDER BY m.name ASC`
      )
      .all(...params);

    return NextResponse.json({ medications });
  } catch (error) {
    console.error("GET /api/medications error:", error);
    return NextResponse.json({ error: "Erro ao consultar medicamentos." }, { status: 500 });
  }
}
