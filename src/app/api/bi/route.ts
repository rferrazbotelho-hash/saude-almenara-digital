import { NextResponse, connection } from "next/server";
import { getDb } from "@/lib/db";
import type { UbsZone } from "@/lib/types";

export async function GET() {
  await connection();
  try {
    const db = getDb();

    const ubsRows = db
      .prepare("SELECT id, name, zone FROM ubs ORDER BY zone DESC, name ASC")
      .all() as Array<{ id: string; name: string; zone: UbsZone }>;

    const aptRows = db
      .prepare("SELECT ubs_id, specialty, status FROM appointments")
      .all() as Array<{ ubs_id: string; specialty: string; status: string }>;

    const activeOrFinished = aptRows.filter((a) => a.status !== "Cancelado");
    const realizedCount = activeOrFinished.filter((a) => a.status === "Realizado").length;
    const missedCount = activeOrFinished.filter((a) => a.status === "Faltou").length;
    const finishedTotal = realizedCount + missedCount;

    const attendanceRate =
      finishedTotal > 0 ? Math.round((realizedCount / finishedTotal) * 1000) / 10 : 0;
    const absenteeismRate =
      finishedTotal > 0 ? Math.round((missedCount / finishedTotal) * 1000) / 10 : 0;

    // Demanda reprimida: pacientes aguardando ou em fila de espera / reposição
    const waitingCount = activeOrFinished.filter(
      (a) => a.status === "Aguardando" || a.status === "Confirmado"
    ).length;
    const repressedDemand = waitingCount + missedCount;

    const byUbs = ubsRows.map((u) => {
      const unitApts = activeOrFinished.filter((a) => a.ubs_id === u.id);
      const realizados = unitApts.filter((a) => a.status === "Realizado").length;
      const faltas = unitApts.filter((a) => a.status === "Faltou").length;
      const confirmados = unitApts.filter((a) => a.status === "Confirmado").length;
      const aguardando = unitApts.filter((a) => a.status === "Aguardando").length;
      const unitFinished = realizados + faltas;
      const unitRate =
        unitFinished > 0 ? Math.round((realizados / unitFinished) * 1000) / 10 : 100;

      return {
        ubsId: u.id,
        name: u.name,
        shortName: u.name.replace("UBS Rural ", "Rural ").replace("UBS ", ""),
        zone: u.zone,
        realizados,
        faltas,
        confirmados,
        aguardando,
        total: unitApts.length,
        attendanceRate: unitRate,
      };
    });

    const specialtyMap = new Map<string, number>();
    for (const a of activeOrFinished) {
      const label =
        a.specialty === "Enfermagem (Preventivo/Pré-natal)"
          ? "Enfermagem"
          : a.specialty;
      specialtyMap.set(label, (specialtyMap.get(label) || 0) + 1);
    }
    const bySpecialty = Array.from(specialtyMap.entries()).map(([name, value]) => ({
      name,
      value,
    }));

    const auditLogs = db
      .prepare("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 30")
      .all();

    return NextResponse.json({
      kpis: {
        totalMonth: activeOrFinished.length,
        attendanceRate,
        absenteeismRate,
        repressedDemand,
        realizedCount,
        missedCount,
      },
      byUbs,
      bySpecialty,
      auditLogs,
    });
  } catch (error) {
    console.error("GET /api/bi error:", error);
    return NextResponse.json({ error: "Erro ao gerar indicadores de BI." }, { status: 500 });
  }
}
