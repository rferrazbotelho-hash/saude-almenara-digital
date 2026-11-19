import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Appointment, BiStats, UbsUnit } from "./types";

async function generateAuthenticityHash(payload: string): Promise<string> {
  if (typeof window !== "undefined" && window.crypto?.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(payload);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 24)
      .toUpperCase();
  }
  return `ALM-${Date.now().toString(16).toUpperCase()}-SUSMG`;
}

async function loadLogoDataUrl(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch("/logo-almenara.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Erro ao ler logo"));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateManagementPdf(
  bi: BiStats,
  appointments: Appointment[] = []
): Promise<string> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const now = new Date();
  const formattedDate = now.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  });

  const hash = await generateAuthenticityHash(
    `${now.toISOString()}-${bi.kpis.totalMonth}-${bi.kpis.realizedCount}-${bi.kpis.missedCount}`
  );
  const logoDataUrl = await loadLogoDataUrl();

  // Cabeçalho Institucional Azul Saúde (#0F4C81)
  doc.setFillColor(15, 76, 129);
  doc.rect(0, 0, 210, 34, "F");

  // Logo oficial Prefeitura de Almenara (ou brasão fallback)
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(14, 6, 26, 22, 2.5, 2.5, "F");
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", 15.5, 7.5, 23, 19);
  } else {
    doc.setFillColor(16, 185, 129);
    doc.rect(25, 11, 4, 12, "F");
    doc.rect(21, 15, 12, 4, "F");
  }

  // Textos do cabeçalho
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("PREFEITURA MUNICIPAL DE ALMENARA - MG", 44, 13);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("SECRETARIA MUNICIPAL DE SAÚDE — SAÚDE ALMENARA DIGITAL (SUS)", 44, 19);

  doc.setFontSize(8.5);
  doc.setTextColor(219, 234, 254);
  doc.text("RELATÓRIO GERENCIAL CONSOLIDADO DE ATENDIMENTOS E AUDITORIA", 44, 25);

  // Faixa de metadados e hash de autenticidade
  doc.setFillColor(248, 250, 252);
  doc.rect(14, 39, 182, 16, "F");
  doc.setDrawColor(203, 213, 225);
  doc.rect(14, 39, 182, 16, "S");

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text(`Data/Hora de Emissão:`, 18, 45);
  doc.setFont("helvetica", "normal");
  doc.text(formattedDate, 53, 45);

  doc.setFont("helvetica", "bold");
  doc.text(`Código Hash de Autenticidade (SHA-256):`, 18, 51);
  doc.setFont("courier", "bold");
  doc.setTextColor(15, 76, 129);
  doc.text(hash, 82, 51);

  // Resumo dos KPIs
  doc.setTextColor(15, 76, 129);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("1. Indicadores Consolidados da Rede Municipal", 14, 65);

  const kpiBoxWidth = 43;
  const kpiItems = [
    { label: "Agendamentos (Mês)", value: String(bi.kpis.totalMonth), color: [15, 76, 129] as const },
    { label: "Comparecimento", value: `${bi.kpis.attendanceRate}%`, color: [16, 185, 129] as const },
    { label: "Absenteísmo", value: `${bi.kpis.absenteeismRate}%`, color: [220, 38, 38] as const },
    { label: "Demanda Reprimida", value: String(bi.kpis.repressedDemand), color: [217, 119, 6] as const },
  ];

  kpiItems.forEach((item, idx) => {
    const x = 14 + idx * (kpiBoxWidth + 3.3);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, 69, kpiBoxWidth, 18, 2, 2, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(item.label, x + 3, 75);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(item.color[0], item.color[1], item.color[2]);
    doc.text(item.value, x + 3, 83);
  });

  // Tabela consolidada por UBS
  doc.setTextColor(15, 76, 129);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("2. Desempenho Consolidado por Unidade Básica de Saúde (UBS)", 14, 97);

  autoTable(doc, {
    startY: 101,
    head: [
      [
        "Unidade de Saúde",
        "Zona",
        "Total",
        "Realizados",
        "Faltas",
        "Em Fila",
        "Comparecimento",
      ],
    ],
    body: bi.byUbs.map((u) => [
      u.name,
      u.zone,
      String(u.total),
      String(u.realizados),
      String(u.faltas),
      String(u.confirmados + u.aguardando),
      `${u.attendanceRate}%`,
    ]),
    theme: "grid",
    headStyles: {
      fillColor: [15, 76, 129],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8.5,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 14, right: 14 },
  });

  const afterTableY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 155;

  // Tabela por especialidade
  doc.setTextColor(15, 76, 129);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("3. Distribuição de Demanda por Especialidade", 14, afterTableY + 10);

  autoTable(doc, {
    startY: afterTableY + 14,
    head: [["Especialidade (Atenção Primária)", "Volume de Atendimentos / Solicitações"]],
    body: bi.bySpecialty.map((s) => [s.name, String(s.value)]),
    theme: "striped",
    headStyles: {
      fillColor: [16, 185, 129],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8.5,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [30, 41, 59],
    },
    margin: { left: 14, right: 14 },
  });

  // Seção 4: Relação Nominal de Agendamentos e Atendimentos
  if (appointments.length > 0) {
    const afterSpecY =
      (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 200;
    const startNominalY = afterSpecY > 230 ? 20 : afterSpecY + 10;
    if (afterSpecY > 230) {
      doc.addPage();
    }

    doc.setTextColor(15, 76, 129);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(
      `4. Relação Nominal de Agendamentos e Atendimentos (${appointments.length} registros)`,
      14,
      startNominalY
    );

    autoTable(doc, {
      startY: startNominalY + 4,
      head: [["Data/Hora", "Paciente", "CNS", "UBS", "Especialidade", "Status"]],
      body: appointments.map((a) => [
        `${a.date.split("-").reverse().join("/")} ${a.time}`,
        a.patient_name,
        a.patient_cns,
        a.ubs_name || a.ubs_id,
        a.specialty === "Enfermagem (Preventivo/Pré-natal)"
          ? "Enfermagem"
          : a.specialty,
        a.status,
      ]),
      theme: "grid",
      headStyles: {
        fillColor: [15, 76, 129],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 7.5,
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [30, 41, 59],
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      margin: { left: 14, right: 14 },
    });
  }

  // Assinatura do(a) Secretário(a) Municipal de Saúde
  const pageHeight = doc.internal.pageSize.getHeight();
  const lastY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 220;
  if (lastY > pageHeight - 42) {
    doc.addPage();
  }
  const signY = Math.min(
    (lastY > pageHeight - 42 ? 35 : lastY + 24),
    pageHeight - 30
  );

  doc.setDrawColor(71, 85, 105);
  doc.line(55, signY, 155, signY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text("Secretário(a) Municipal de Saúde", 105, signY + 5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Prefeitura Municipal de Almenara - MG | Conformidade TCE-MG e LGPD", 105, signY + 10, {
    align: "center",
  });

  // Rodapé
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Documento gerado eletronicamente pelo sistema Saúde Almenara Digital • Hash: ${hash}`,
    14,
    pageHeight - 8
  );

  const fileName = `Relatorio_Gerencial_SMS_Almenara_${now.toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
  return hash;
}

export async function generateUbsFullPdf(
  ubs: UbsUnit,
  appointments: Appointment[]
): Promise<string> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const now = new Date();
  const formattedDate = now.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  });

  const ubsAppointments = appointments.filter((a) => a.ubs_id === ubs.id);
  const realized = ubsAppointments.filter((a) => a.status === "Realizado").length;
  const missed = ubsAppointments.filter((a) => a.status === "Faltou").length;
  const activeQueue = ubsAppointments.filter(
    (a) => a.status === "Confirmado" || a.status === "Aguardando"
  ).length;
  const finished = realized + missed;
  const rate = finished > 0 ? Math.round((realized / finished) * 1000) / 10 : 100;

  const hash = await generateAuthenticityHash(
    `${now.toISOString()}-${ubs.id}-${ubsAppointments.length}-${realized}`
  );
  const logoDataUrl = await loadLogoDataUrl();

  // Cabeçalho
  doc.setFillColor(15, 76, 129);
  doc.rect(0, 0, 210, 34, "F");

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(14, 6, 26, 22, 2.5, 2.5, "F");
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", 15.5, 7.5, 23, 19);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`RELATÓRIO COMPLETO DE UNIDADE — ${ubs.name.toUpperCase()}`, 44, 13);

  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.text("PREFEITURA MUNICIPAL DE ALMENARA - MG | SECRETARIA MUNICIPAL DE SAÚDE", 44, 19);

  doc.setFontSize(8.5);
  doc.setTextColor(219, 234, 254);
  doc.text(`Zona: ${ubs.zone} • Horário: ${ubs.hours} • Tel: ${ubs.phone}`, 44, 25);

  // Metadados
  doc.setFillColor(248, 250, 252);
  doc.rect(14, 39, 182, 18, "F");
  doc.setDrawColor(203, 213, 225);
  doc.rect(14, 39, 182, 18, "S");

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text("Endereço da UBS:", 18, 45);
  doc.setFont("helvetica", "normal");
  doc.text(ubs.address, 47, 45);

  doc.setFont("helvetica", "bold");
  doc.text("Emissão:", 18, 51);
  doc.setFont("helvetica", "normal");
  doc.text(formattedDate, 34, 51);

  doc.setFont("helvetica", "bold");
  doc.text("Hash:", 95, 51);
  doc.setFont("courier", "bold");
  doc.setTextColor(15, 76, 129);
  doc.text(hash, 106, 51);

  // KPIs da UBS
  doc.setTextColor(15, 76, 129);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("1. Resumo de Agendamentos e Atendimentos da Unidade", 14, 67);

  const boxW = 43;
  const items = [
    { label: "Total Agendados", value: String(ubsAppointments.length), color: [15, 76, 129] as const },
    { label: "Atend. Realizados", value: String(realized), color: [16, 185, 129] as const },
    { label: "Faltas Registradas", value: String(missed), color: [220, 38, 38] as const },
    { label: "Comparecimento / Fila", value: `${rate}% (${activeQueue})`, color: [217, 119, 6] as const },
  ];
  items.forEach((it, idx) => {
    const x = 14 + idx * (boxW + 3.3);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, 71, boxW, 18, 2, 2, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(it.label, x + 3, 77);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(it.color[0], it.color[1], it.color[2]);
    doc.text(it.value, x + 3, 85);
  });

  // Tabela nominal completa da UBS
  doc.setTextColor(15, 76, 129);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("2. Relação Nominal de Pacientes, Agendamentos e Atendimentos", 14, 99);

  autoTable(doc, {
    startY: 103,
    head: [["Data/Hora", "Nome do Paciente", "CPF (LGPD)", "Cartão SUS (CNS)", "Especialidade", "Tipo", "Status"]],
    body: ubsAppointments.map((a) => [
      `${a.date.split("-").reverse().join("/")} ${a.time}`,
      a.patient_name,
      a.patient_cpf_masked,
      a.patient_cns,
      a.specialty === "Enfermagem (Preventivo/Pré-natal)" ? "Enfermagem" : a.specialty,
      a.is_walkin === 1 ? "Encaixe" : "Portal",
      a.status,
    ]),
    theme: "grid",
    headStyles: {
      fillColor: [15, 76, 129],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 7.5,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 14, right: 14 },
  });

  const pageHeight = doc.internal.pageSize.getHeight();
  const lastY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 220;
  if (lastY > pageHeight - 40) {
    doc.addPage();
  }
  const signY = Math.min(lastY > pageHeight - 40 ? 35 : lastY + 24, pageHeight - 30);

  doc.setDrawColor(71, 85, 105);
  doc.line(55, signY, 155, signY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text(`Coordenação ${ubs.name} / Secretaria Municipal de Saúde`, 105, signY + 5, {
    align: "center",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Almenara/MG • Hash: ${hash}`, 105, signY + 10, { align: "center" });

  const safeSlug = ubs.id.replace(/[^a-z0-9-]/gi, "_");
  doc.save(`Relatorio_Completo_${safeSlug}_${now.toISOString().slice(0, 10)}.pdf`);
  return hash;
}
