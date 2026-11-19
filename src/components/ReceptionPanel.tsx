"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  Pill,
  PlusCircle,
  Search,
  UserPlus,
  X,
  XCircle,
} from "lucide-react";
import {
  SPECIALTIES,
  TIME_SLOTS,
  type Appointment,
  type Medication,
  type MedicationStatus,
  type Specialty,
  type UbsUnit,
} from "@/lib/types";
import type { ToastItem } from "./ToastContainer";

interface ReceptionPanelProps {
  ubsList: UbsUnit[];
  appointments: Appointment[];
  medications: Medication[];
  onRefresh: () => Promise<void>;
  onToast: (toast: Omit<ToastItem, "id">) => void;
}

function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function ReceptionPanel({
  ubsList,
  appointments,
  medications,
  onRefresh,
  onToast,
}: ReceptionPanelProps) {
  const [filterUbsId, setFilterUbsId] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>(getTodayIso());
  const [updatingAptId, setUpdatingAptId] = useState<string | null>(null);
  const [updatingMedId, setUpdatingMedId] = useState<string | null>(null);
  const [medSearch, setMedSearch] = useState("");

  // Modal Encaixe Presencial
  const [showWalkinModal, setShowWalkinModal] = useState(false);
  const [walkinName, setWalkinName] = useState("");
  const [walkinCns, setWalkinCns] = useState("700 9981 2234 5510");
  const [walkinUbsId, setWalkinUbsId] = useState(ubsList[0]?.id || "ubs-centro");
  const [walkinSpecialty, setWalkinSpecialty] =
    useState<Specialty>("Clínico Geral");
  const [walkinTime, setWalkinTime] = useState("11:00");
  const [submittingWalkin, setSubmittingWalkin] = useState(false);

  const dayQueue = useMemo(() => {
    return appointments.filter((a) => {
      if (filterDate && a.date !== filterDate) return false;
      if (filterUbsId !== "all" && a.ubs_id !== filterUbsId) return false;
      return true;
    });
  }, [appointments, filterDate, filterUbsId]);

  const filteredMeds = useMemo(() => {
    const q = medSearch.trim().toLowerCase();
    return medications.filter((m) => {
      if (filterUbsId !== "all" && m.ubs_id !== filterUbsId) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.active_ingredient.toLowerCase().includes(q) ||
        (m.ubs_name || "").toLowerCase().includes(q)
      );
    });
  }, [medications, filterUbsId, medSearch]);

  async function handleReceptionAction(
    apt: Appointment,
    newStatus: "Realizado" | "Faltou"
  ) {
    setUpdatingAptId(apt.id);
    try {
      const res = await fetch(`/api/appointments/${apt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          actorName: "Recepção UBS (Operacional)",
          actorRole: "Recepção / Farmácia",
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        onToast({
          type: "error",
          title: "Erro ao atualizar agenda",
          message: data.error,
        });
        return;
      }

      onToast({
        type: newStatus === "Realizado" ? "success" : "warning",
        title:
          newStatus === "Realizado"
            ? "Comparecimento confirmado"
            : "Falta registrada",
        message: `${apt.patient_name} (${apt.specialty}) marcado como ${newStatus}.`,
      });
      await onRefresh();
    } catch {
      onToast({
        type: "error",
        title: "Falha de conexão",
        message: "Não foi possível atualizar o atendimento.",
      });
    } finally {
      setUpdatingAptId(null);
    }
  }

  async function handleWalkinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!walkinName.trim() || !walkinCns.trim()) {
      onToast({
        type: "warning",
        title: "Preencha os dados",
        message: "Informe o nome completo e o Cartão SUS (CNS) do paciente.",
      });
      return;
    }

    setSubmittingWalkin(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName: walkinName.trim(),
          patientCns: walkinCns.trim(),
          patientCpfMasked: "***.210.840-**",
          ubsId: walkinUbsId,
          specialty: walkinSpecialty,
          date: filterDate || getTodayIso(),
          time: walkinTime,
          isWalkin: true,
          actorName: "Recepção UBS (Operacional)",
          actorRole: "Recepção / Farmácia",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast({
          type: "error",
          title: "Não foi possível registrar encaixe",
          message: data.error,
        });
        return;
      }

      onToast({
        type: "success",
        title: "Encaixe presencial inserido!",
        message: `${walkinName.trim()} adicionado(a) na fila de ${walkinSpecialty} às ${walkinTime}.`,
      });
      setWalkinName("");
      setShowWalkinModal(false);
      await onRefresh();
    } catch {
      onToast({
        type: "error",
        title: "Erro ao registrar encaixe",
        message: "Verifique a conexão e tente novamente.",
      });
    } finally {
      setSubmittingWalkin(false);
    }
  }

  async function handleMedicationStatus(
    med: Medication,
    status: MedicationStatus
  ) {
    if (med.status === status) return;
    setUpdatingMedId(med.id);
    try {
      const res = await fetch(`/api/medications/${med.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          actorName: "Farmácia Municipal (UBS)",
          actorRole: "Recepção / Farmácia",
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        onToast({
          type: "error",
          title: "Erro ao atualizar estoque",
          message: data.error,
        });
        return;
      }

      onToast({
        type: "success",
        title: "Estoque REMUME atualizado",
        message: `${med.name} (${med.ubs_name}) agora está "${status}" no app do cidadão.`,
      });
      await onRefresh();
    } catch {
      onToast({
        type: "error",
        title: "Erro de comunicação",
        message: "Não foi possível atualizar o medicamento.",
      });
    } finally {
      setUpdatingMedId(null);
    }
  }

  const statusPill = (status: Appointment["status"]) => {
    const map: Record<Appointment["status"], string> = {
      Confirmado: "bg-emerald-100 text-emerald-800",
      Aguardando: "bg-amber-100 text-amber-800",
      Realizado: "bg-sky-100 text-[#0F4C81]",
      Faltou: "bg-red-100 text-red-800",
      Cancelado: "bg-slate-100 text-slate-500",
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[status]}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Barra de Filtros Operacionais */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 hc-card">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label
              htmlFor="rec-ubs-filter"
              className="block text-[11px] font-semibold text-slate-500 uppercase hc-muted"
            >
              Unidade Básica de Saúde
            </label>
            <select
              id="rec-ubs-filter"
              value={filterUbsId}
              onChange={(e) => setFilterUbsId(e.target.value)}
              className="mt-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0F4C81]"
            >
              <option value="all">Todas as UBS (Almenara)</option>
              {ubsList.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="rec-date-filter"
              className="block text-[11px] font-semibold text-slate-500 uppercase hc-muted"
            >
              Data da Agenda
            </label>
            <input
              id="rec-date-filter"
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="mt-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0F4C81]"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowWalkinModal(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F4C81] hover:bg-[#0c3d68] text-white text-sm font-bold shadow-sm transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Encaixe Presencial
        </button>
      </div>

      {/* Layout Desktop-First em 2 Seções */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Controle de Agenda do Dia */}
        <section className="xl:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hc-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-[#0F4C81]" />
              <h2 className="text-base sm:text-lg font-bold">
                Controle de Agenda do Dia
              </h2>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-sky-50 text-[#0F4C81] border border-sky-200">
              {dayQueue.length} paciente(s)
            </span>
          </div>

          {dayQueue.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-sm text-slate-500 hc-muted">
                Nenhum agendamento encontrado para a data e UBS selecionadas.
              </p>
              <button
                type="button"
                onClick={() => setShowWalkinModal(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F4C81] hover:underline"
              >
                <PlusCircle className="w-4 h-4" />
                Inserir Encaixe Presencial
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500 hc-muted">
                    <th className="py-2.5 pr-3">Hora</th>
                    <th className="py-2.5 pr-3">Paciente / CNS</th>
                    <th className="py-2.5 pr-3">UBS / Especialidade</th>
                    <th className="py-2.5 pr-3">Status</th>
                    <th className="py-2.5 text-right">Ações Rápidas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {dayQueue.map((apt) => {
                    const isBusy = updatingAptId === apt.id;
                    const isDone =
                      apt.status === "Realizado" ||
                      apt.status === "Faltou" ||
                      apt.status === "Cancelado";
                    return (
                      <tr key={apt.id} className="hover:bg-slate-50/70">
                        <td className="py-3 pr-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                          {apt.time}
                        </td>
                        <td className="py-3 pr-3">
                          <p className="font-semibold text-slate-900 leading-tight">
                            {apt.patient_name}
                            {apt.is_walkin === 1 && (
                              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded bg-sky-100 text-[#0F4C81] font-bold">
                                ENCAIXE
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500 font-mono hc-muted">
                            CNS: {apt.patient_cns}
                          </p>
                        </td>
                        <td className="py-3 pr-3">
                          <p className="text-xs font-semibold text-[#0F4C81]">
                            {apt.ubs_name}
                          </p>
                          <p className="text-xs text-slate-600 hc-muted">
                            {apt.specialty}
                          </p>
                        </td>
                        <td className="py-3 pr-3 whitespace-nowrap">
                          {statusPill(apt.status)}
                        </td>
                        <td className="py-3 text-right whitespace-nowrap">
                          {!isDone ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  handleReceptionAction(apt, "Realizado")
                                }
                                title="Confirmar Comparecimento"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#10B981] hover:bg-emerald-600 text-white transition-colors disabled:opacity-50"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Compareceu
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  handleReceptionAction(apt, "Faltou")
                                }
                                title="Registrar Falta"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-colors disabled:opacity-50"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Falta
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">
                              Finalizado
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Gestão Rápida da Farmácia Municipal (REMUME) */}
        <section className="xl:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hc-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <Pill className="w-5 h-5 text-[#10B981]" />
                Farmácia Municipal (REMUME)
              </h2>
              <p className="text-xs text-slate-500 hc-muted">
                Alterne o status em 1 clique — reflete em tempo real para o cidadão
              </p>
            </div>
          </div>

          <div className="relative mb-3">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={medSearch}
              onChange={(e) => setMedSearch(e.target.value)}
              placeholder="Filtrar medicamento na farmácia..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]"
            />
          </div>

          <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto pr-1">
            {filteredMeds.map((med) => {
              const isBusy = updatingMedId === med.id;
              const options: MedicationStatus[] = [
                "Disponível",
                "Estoque Baixo",
                "Em Reposição",
              ];
              return (
                <div key={med.id} className="py-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{med.name}</p>
                      <p className="text-xs text-slate-500 hc-muted">
                        {med.active_ingredient} •{" "}
                        <span className="font-semibold text-[#0F4C81]">
                          {med.ubs_name}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {options.map((opt) => {
                      const active = med.status === opt;
                      const activeClass =
                        opt === "Disponível"
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : opt === "Estoque Baixo"
                            ? "bg-amber-500 text-white border-amber-500"
                            : "bg-red-600 text-white border-red-600";
                      return (
                        <button
                          key={opt}
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleMedicationStatus(med, opt)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                            active
                              ? activeClass
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Modal Encaixe Presencial */}
      {showWalkinModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Registrar Encaixe Presencial"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setShowWalkinModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 hc-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#0F4C81] flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#10B981]" />
                Encaixe Presencial (Sem Smartphone)
              </h3>
              <button
                type="button"
                onClick={() => setShowWalkinModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleWalkinSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome Completo do Paciente
                </label>
                <input
                  type="text"
                  required
                  value={walkinName}
                  onChange={(e) => setWalkinName(e.target.value)}
                  placeholder="Ex: Geraldo Pereira da Silva"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cartão Nacional de Saúde (CNS)
                </label>
                <input
                  type="text"
                  required
                  value={walkinCns}
                  onChange={(e) => setWalkinCns(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0F4C81]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    UBS
                  </label>
                  <select
                    value={walkinUbsId}
                    onChange={(e) => setWalkinUbsId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    {ubsList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Horário do Encaixe
                  </label>
                  <select
                    value={walkinTime}
                    onChange={(e) => setWalkinTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="11:00">11:00 (Encaixe Manhã)</option>
                    <option value="16:00">16:00 (Encaixe Tarde)</option>
                    {TIME_SLOTS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Especialidade
                </label>
                <select
                  value={walkinSpecialty}
                  onChange={(e) =>
                    setWalkinSpecialty(e.target.value as Specialty)
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  {SPECIALTIES.map((sp) => (
                    <option key={sp} value={sp}>
                      {sp}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWalkinModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingWalkin}
                  className="flex-1 py-2.5 rounded-xl bg-[#10B981] hover:bg-emerald-600 text-white text-sm font-bold disabled:opacity-50"
                >
                  {submittingWalkin ? "Salvando..." : "Inserir na Fila"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
