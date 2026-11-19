"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertOctagon,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileDown,
  Search,
  ShieldAlert,
  TrendingDown,
  Users,
} from "lucide-react";
import type { Appointment, BiStats, UbsUnit } from "@/lib/types";
import { generateManagementPdf, generateUbsFullPdf } from "@/lib/pdfReport";
import type { ToastItem } from "./ToastContainer";

interface ManagementPanelProps {
  bi: BiStats | null;
  ubsList: UbsUnit[];
  appointments: Appointment[];
  onRefresh: () => Promise<void>;
  onToast: (toast: Omit<ToastItem, "id">) => void;
}

const PIE_COLORS = ["#0F4C81", "#10B981", "#F59E0B", "#6366F1"];

export function ManagementPanel({
  bi,
  ubsList,
  appointments,
  onRefresh,
  onToast,
}: ManagementPanelProps) {
  const [exporting, setExporting] = useState(false);
  const [exportingUbsId, setExportingUbsId] = useState<string | null>(null);
  const [reportUbsId, setReportUbsId] = useState<string>("all");
  const [reportStatus, setReportStatus] = useState<string>("all");
  const [reportSearch, setReportSearch] = useState("");

  const filteredAppointments = useMemo(() => {
    const q = reportSearch.trim().toLowerCase();
    return appointments.filter((a) => {
      if (reportUbsId !== "all" && a.ubs_id !== reportUbsId) return false;
      if (reportStatus !== "all" && a.status !== reportStatus) return false;
      if (!q) return true;
      return (
        a.patient_name.toLowerCase().includes(q) ||
        a.patient_cns.toLowerCase().includes(q) ||
        (a.ubs_name || "").toLowerCase().includes(q) ||
        a.specialty.toLowerCase().includes(q)
      );
    });
  }, [appointments, reportUbsId, reportStatus, reportSearch]);

  if (!bi) {
    return (
      <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 hc-card">
        <p className="text-sm text-slate-500">Carregando indicadores de Gestão Pública...</p>
      </div>
    );
  }

  async function handleExportPdf() {
    if (!bi) return;
    setExporting(true);
    try {
      const hash = await generateManagementPdf(bi, filteredAppointments);
      await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userName: "Secretário(a) Municipal de Saúde",
          userRole: "Gestão Pública (BI)",
          action: "EXPORTACAO_RELATORIO_PDF",
          details: `Relatório Gerencial PDF emitido (${filteredAppointments.length} registros nominais) com hash ${hash}`,
        }),
      });
      await onRefresh();
      onToast({
        type: "success",
        title: "Relatório Gerencial (PDF) gerado!",
        message: `Documento oficial baixado com hash ${hash}.`,
      });
    } catch {
      onToast({
        type: "error",
        title: "Erro ao gerar PDF",
        message: "Não foi possível gerar o relatório gerencial.",
      });
    } finally {
      setExporting(false);
    }
  }

  async function handleExportUbsPdf(ubs: UbsUnit) {
    setExportingUbsId(ubs.id);
    try {
      const hash = await generateUbsFullPdf(ubs, appointments);
      await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userName: "Secretário(a) Municipal de Saúde",
          userRole: "Gestão Pública (BI)",
          action: "EXPORTACAO_RELATORIO_UBS_PDF",
          details: `Relatório Completo da ${ubs.name} emitido com hash ${hash}`,
        }),
      });
      await onRefresh();
      onToast({
        type: "success",
        title: `Relatório Completo — ${ubs.name}`,
        message: `PDF nominal da unidade baixado (Hash: ${hash}).`,
      });
    } catch {
      onToast({
        type: "error",
        title: "Erro ao gerar PDF da UBS",
        message: "Não foi possível gerar o relatório da unidade.",
      });
    } finally {
      setExportingUbsId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho do Painel + Botão Exportação Oficial */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 hc-card">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[#0F4C81]">
            Painel de Gestão Pública & Auditoria (BI)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 hc-muted">
            Monitoramento em tempo real da Atenção Primária de Almenara/MG — Conformidade TCE-MG e LGPD
          </p>
        </div>

        <button
          type="button"
          disabled={exporting}
          onClick={handleExportPdf}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F4C81] hover:bg-[#0c3d68] text-white text-sm font-bold shadow-sm transition-colors disabled:opacity-50"
        >
          <FileDown className="w-4 h-4" />
          {exporting
            ? "Gerando PDF Oficial..."
            : "Gerar Relatório Gerencial (PDF)"}
        </button>
      </div>

      {/* Cards de KPIs em Tempo Real */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hc-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 hc-muted">
              Total de Agendamentos (Mês)
            </span>
            <CalendarDays className="w-5 h-5 text-[#0F4C81]" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-[#0F4C81] mt-2">
            {bi.kpis.totalMonth}
          </p>
          <p className="text-xs text-slate-500 mt-1 hc-muted">
            Distribuídos entre 5 UBS (Sede e Rural)
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hc-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 hc-muted">
              Taxa de Comparecimento
            </span>
            <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-[#10B981] mt-2">
            {bi.kpis.attendanceRate}%
          </p>
          <p className="text-xs text-slate-500 mt-1 hc-muted">
            {bi.kpis.realizedCount} atendimentos realizados
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hc-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 hc-muted">
              Taxa de Absenteísmo
            </span>
            <TrendingDown className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-red-600 mt-2">
            {bi.kpis.absenteeismRate}%
          </p>
          <p className="text-xs text-slate-500 mt-1 hc-muted">
            {bi.kpis.missedCount} faltas registradas no período
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hc-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 hc-muted">
              Demanda Reprimida
            </span>
            <AlertOctagon className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-amber-600 mt-2">
            {bi.kpis.repressedDemand}
          </p>
          <p className="text-xs text-slate-500 mt-1 hc-muted">
            Em fila ativa + retornos por falta
          </p>
        </div>
      </div>

      {/* Gráficos Analíticos (Recharts) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hc-card">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-1">
            Atendimentos Realizados vs. Faltas por UBS
          </h3>
          <p className="text-xs text-slate-500 mb-4 hc-muted">
            Comparativo entre unidades urbanas (Sede) e Zona Rural (Pedra Grande)
          </p>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={bi.byUbs}
                margin={{ top: 10, right: 16, left: -12, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  dataKey="shortName"
                  tick={{ fontSize: 11, fill: "#475569" }}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#475569" }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="realizados"
                  name="Realizados"
                  fill="#10B981"
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="faltas"
                  name="Faltas"
                  fill="#EF4444"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hc-card">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-1">
            Distribuição de Demanda por Especialidade
          </h3>
          <p className="text-xs text-slate-500 mb-4 hc-muted">
            Proporção de agendamentos na Atenção Primária
          </p>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={bi.bySpecialty}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  innerRadius={52}
                  outerRadius={86}
                  paddingAngle={4}
                >
                  {bi.bySpecialty.map((entry, idx) => (
                    <Cell
                      key={entry.name}
                      fill={PIE_COLORS[idx % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Relatórios Completos por UBS (Agendamentos, Atendimentos e Nomes) */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-5 hc-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#0F4C81]" />
            <div>
              <h3 className="text-sm sm:text-base font-bold">
                Relatórios Completos por UBS (Agendamentos, Atendimentos & Nomes)
              </h3>
              <p className="text-xs text-slate-500 hc-muted">
                Exporte o relatório individual completo de cada unidade ou filtre a relação nominal abaixo
              </p>
            </div>
          </div>
        </div>

        {/* Cards individuais por UBS com download direto em PDF */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {ubsList.map((ubs) => {
            const stat = bi.byUbs.find((b) => b.ubsId === ubs.id);
            const isBusy = exportingUbsId === ubs.id;
            return (
              <div
                key={ubs.id}
                className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 flex flex-col justify-between gap-3 hc-card"
              >
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-extrabold text-[#0F4C81] leading-tight">
                      {ubs.name}
                    </span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                      {ubs.zone}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 mt-2.5 text-center text-[11px]">
                    <div className="bg-white rounded-lg p-1.5 border border-slate-100">
                      <span className="block text-slate-400 text-[10px]">Agend.</span>
                      <strong className="text-slate-900">{stat?.total ?? 0}</strong>
                    </div>
                    <div className="bg-white rounded-lg p-1.5 border border-slate-100">
                      <span className="block text-emerald-600 text-[10px]">Atend.</span>
                      <strong className="text-emerald-700">{stat?.realizados ?? 0}</strong>
                    </div>
                    <div className="bg-white rounded-lg p-1.5 border border-slate-100">
                      <span className="block text-red-500 text-[10px]">Faltas</span>
                      <strong className="text-red-600">{stat?.faltas ?? 0}</strong>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleExportUbsPdf(ubs)}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-[#0F4C81] hover:bg-[#0c3d68] text-white text-[11px] font-bold transition-colors disabled:opacity-50"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  {isBusy ? "Gerando..." : "PDF Completo"}
                </button>
              </div>
            );
          })}
        </div>

        {/* Filtros da Relação Nominal */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#0F4C81]">
              <Users className="w-4 h-4" />
              Relação Nominal ({filteredAppointments.length})
            </div>
            <select
              value={reportUbsId}
              onChange={(e) => setReportUbsId(e.target.value)}
              aria-label="Filtrar relatório por UBS"
              className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium"
            >
              <option value="all">Todas as UBS</option>
              {ubsList.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <select
              value={reportStatus}
              onChange={(e) => setReportStatus(e.target.value)}
              aria-label="Filtrar relatório por Status"
              className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium"
            >
              <option value="all">Todos os Status</option>
              <option value="Realizado">Atendimentos Realizados</option>
              <option value="Confirmado">Confirmados</option>
              <option value="Aguardando">Aguardando</option>
              <option value="Faltou">Faltas</option>
              <option value="Cancelado">Cancelados</option>
            </select>
          </div>

          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={reportSearch}
              onChange={(e) => setReportSearch(e.target.value)}
              placeholder="Buscar nome do paciente ou CNS..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 bg-slate-50 text-xs focus:outline-none focus:ring-2 focus:ring-[#0F4C81]"
            />
          </div>
        </div>

        {/* Tabela Nominal de Agendamentos e Atendimentos */}
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500 hc-muted">
                <th className="py-2.5 pr-3">Data / Hora</th>
                <th className="py-2.5 pr-3">Nome do Paciente</th>
                <th className="py-2.5 pr-3">CPF / CNS</th>
                <th className="py-2.5 pr-3">UBS</th>
                <th className="py-2.5 pr-3">Especialidade</th>
                <th className="py-2.5 pr-3">Origem</th>
                <th className="py-2.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredAppointments.map((apt) => (
                <tr key={apt.id} className="hover:bg-slate-50/70">
                  <td className="py-2.5 pr-3 font-mono whitespace-nowrap text-slate-700">
                    {apt.date.split("-").reverse().join("/")} {apt.time}
                  </td>
                  <td className="py-2.5 pr-3 font-bold text-slate-900">
                    {apt.patient_name}
                  </td>
                  <td className="py-2.5 pr-3 font-mono text-slate-600 whitespace-nowrap hc-muted">
                    {apt.patient_cpf_masked} • {apt.patient_cns}
                  </td>
                  <td className="py-2.5 pr-3 font-semibold text-[#0F4C81] whitespace-nowrap">
                    {apt.ubs_name}
                  </td>
                  <td className="py-2.5 pr-3 text-slate-700">
                    {apt.specialty}
                  </td>
                  <td className="py-2.5 pr-3 whitespace-nowrap">
                    {apt.is_walkin === 1 ? "Encaixe Presencial" : "Portal Digital"}
                  </td>
                  <td className="py-2.5 text-right whitespace-nowrap font-semibold">
                    {apt.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Logs de Auditoria (Conformidade LGPD) */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hc-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[#0F4C81]" />
            <div>
              <h3 className="text-sm sm:text-base font-bold">
                Logs de Auditoria Imutáveis (Conformidade LGPD / TCE-MG)
              </h3>
              <p className="text-xs text-slate-500 hc-muted">
                Rastreabilidade completa de ações sensíveis, agendamentos e alterações de estoque
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <Clock className="w-3.5 h-3.5" />
            Trilha em tempo real
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500 hc-muted">
                <th className="py-2.5 pr-3">Data / Hora</th>
                <th className="py-2.5 pr-3">Usuário</th>
                <th className="py-2.5 pr-3">Perfil</th>
                <th className="py-2.5 pr-3">Ação Realizada</th>
                <th className="py-2.5 pr-3">Detalhes</th>
                <th className="py-2.5 text-right">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {bi.auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/70">
                  <td className="py-2.5 pr-3 font-mono whitespace-nowrap text-slate-600 hc-muted">
                    {new Date(log.created_at).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "medium",
                    })}
                  </td>
                  <td className="py-2.5 pr-3 font-semibold text-slate-900 whitespace-nowrap">
                    {log.user_name}
                  </td>
                  <td className="py-2.5 pr-3 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                      {log.user_role}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 font-mono font-semibold text-[#0F4C81] whitespace-nowrap">
                    {log.action}
                  </td>
                  <td className="py-2.5 pr-3 text-slate-600 hc-muted">
                    {log.details}
                  </td>
                  <td className="py-2.5 text-right font-mono text-slate-500 whitespace-nowrap">
                    {log.ip_address}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
