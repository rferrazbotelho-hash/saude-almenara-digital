"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Clock,
  CreditCard,
  MapPin,
  Pill,
  QrCode,
  RefreshCw,
  Search,
  Sparkles,
  Syringe,
  UserCheck,
  X,
  XCircle,
} from "lucide-react";
import {
  SPECIALTIES,
  type Appointment,
  type Medication,
  type Patient,
  type Specialty,
  type UbsUnit,
  type VaccineRecord,
} from "@/lib/types";
import type { ToastItem } from "./ToastContainer";

interface CitizenPortalProps {
  ubsList: UbsUnit[];
  patients: Patient[];
  appointments: Appointment[];
  medications: Medication[];
  initialPatientId?: string;
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

function formatDateBr(iso: string): string {
  return iso.split("-").reverse().join("/");
}

function daysBetween(isoA: string, isoB: string): number {
  const a = new Date(`${isoA}T00:00:00Z`).getTime();
  const b = new Date(`${isoB}T00:00:00Z`).getTime();
  return Math.abs(Math.round((a - b) / (1000 * 60 * 60 * 24)));
}

export function CitizenPortal({
  ubsList,
  patients,
  appointments,
  medications,
  initialPatientId,
  onRefresh,
  onToast,
}: CitizenPortalProps) {
  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    initialPatientId || patients[0]?.id || "pat-maria"
  );
  const [showQrModal, setShowQrModal] = useState(false);

  // Agendamento state
  const [selectedUbsId, setSelectedUbsId] = useState<string>(
    ubsList[0]?.id || "ubs-centro"
  );
  const [selectedSpecialty, setSelectedSpecialty] = useState<Specialty>("Clínico Geral");
  const [selectedDate, setSelectedDate] = useState<string>(getTodayIso());
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [slots, setSlots] = useState<Array<{ time: string; available: boolean }>>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // REMUME search state
  const [medQuery, setMedQuery] = useState("");

  // Meu SUS Digital (Cartão de Vacinas + CNS Sync)
  const [vaccines, setVaccines] = useState<VaccineRecord[]>([]);
  const [showMeuSusModal, setShowMeuSusModal] = useState(false);
  const [syncCpf, setSyncCpf] = useState("123.456.789-00");
  const [syncingMeuSus, setSyncingMeuSus] = useState(false);

  const activePatient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId) || patients[0],
    [patients, selectedPatientId]
  );

  // Carrega Cartão de Vacinas do paciente ativo
  useEffect(() => {
    if (!activePatient) return;
    let active = true;
    const loadVaccines = async () => {
      try {
        const res = await fetch(
          `/api/meusus/sync?patientId=${encodeURIComponent(activePatient.id)}`
        );
        const data = await res.json();
        if (active && res.ok && Array.isArray(data.vaccines)) {
          setVaccines(data.vaccines);
        }
      } catch {
        // ignore transient error
      }
    };
    void loadVaccines();
    return () => {
      active = false;
    };
  }, [activePatient]);

  function formatCpfInput(raw: string): string {
    const digits = raw.replace(/\D/g, "").slice(0, 11);
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }

  async function handleMeuSusSync(e: React.FormEvent) {
    e.preventDefault();
    if (!activePatient) return;
    setSyncingMeuSus(true);
    try {
      const res = await fetch("/api/meusus/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: activePatient.id,
          cpf: syncCpf,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast({
          type: "error",
          title: "Falha na sincronização Meu SUS",
          message: data.error,
        });
        return;
      }

      if (Array.isArray(data.vaccines)) {
        setVaccines(data.vaccines);
      }
      setShowMeuSusModal(false);
      await onRefresh();
      onToast({
        type: "success",
        title: "Sincronizado com Meu SUS Digital!",
        message: `Cartão SUS (${data.cns}) e ${data.vaccines?.length || 0} registros de vacinas atualizados via RNDS.`,
      });
    } catch {
      onToast({
        type: "error",
        title: "Erro de conexão",
        message: "Não foi possível conectar ao conector Meu SUS Digital.",
      });
    } finally {
      setSyncingMeuSus(false);
    }
  }

  const patientUbs = useMemo(
    () => ubsList.find((u) => u.id === activePatient?.ubs_id),
    [ubsList, activePatient]
  );

  const myAppointments = useMemo(() => {
    if (!activePatient) return [];
    return appointments.filter((a) => a.patient_id === activePatient.id);
  }, [appointments, activePatient]);

  // Verifica trava anti-duplicidade (15 dias na mesma especialidade) no frontend
  const antiDuplicityConflict = useMemo(() => {
    if (!activePatient || !selectedDate) return null;
    return (
      myAppointments.find(
        (a) =>
          a.specialty === selectedSpecialty &&
          a.status !== "Cancelado" &&
          daysBetween(a.date, selectedDate) < 15
      ) || null
    );
  }, [activePatient, myAppointments, selectedSpecialty, selectedDate]);

  const fetchSlots = useCallback(async () => {
    if (!selectedUbsId || !selectedDate) return;
    try {
      const res = await fetch(
        `/api/appointments/slots?ubsId=${encodeURIComponent(selectedUbsId)}&date=${encodeURIComponent(selectedDate)}`
      );
      const data = await res.json();
      if (res.ok && Array.isArray(data.slots)) {
        setSlots(data.slots);
        // Se o horário selecionado deixou de estar disponível, limpa
        setSelectedTime((prev) => {
          const stillFree = data.slots.some(
            (s: { time: string; available: boolean }) => s.time === prev && s.available
          );
          return stillFree ? prev : "";
        });
      }
    } catch {
      // ignore transient error
    } finally {
      setLoadingSlots(false);
    }
  }, [selectedUbsId, selectedDate]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!selectedUbsId || !selectedDate) return;
      try {
        const res = await fetch(
          `/api/appointments/slots?ubsId=${encodeURIComponent(selectedUbsId)}&date=${encodeURIComponent(selectedDate)}`
        );
        const data = await res.json();
        if (active && res.ok && Array.isArray(data.slots)) {
          setSlots(data.slots);
          setSelectedTime((prev) => {
            const stillFree = data.slots.some(
              (s: { time: string; available: boolean }) => s.time === prev && s.available
            );
            return stillFree ? prev : "";
          });
        }
      } catch {
        // ignore transient error
      } finally {
        if (active) setLoadingSlots(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [selectedUbsId, selectedDate, appointments]);

  const filteredMedications = useMemo(() => {
    const q = medQuery.trim().toLowerCase();
    if (!q) return medications;
    return medications.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.active_ingredient.toLowerCase().includes(q) ||
        (m.ubs_name || "").toLowerCase().includes(q)
    );
  }, [medications, medQuery]);

  async function handleSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!activePatient) return;

    if (!selectedTime) {
      onToast({
        type: "warning",
        title: "Selecione um horário",
        message: "Escolha um horário disponível na grade para concluir seu agendamento.",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: activePatient.id,
          patientName: activePatient.name,
          patientCns: activePatient.cns,
          patientCpfMasked: activePatient.cpf_masked,
          ubsId: selectedUbsId,
          specialty: selectedSpecialty,
          date: selectedDate,
          time: selectedTime,
          isWalkin: false,
          actorName: activePatient.name,
          actorRole: "Cidadão (Munícipe)",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        onToast({
          type: "error",
          title:
            data.code === "ANTI_DUPLICIDADE_15_DIAS"
              ? "Agendamento bloqueado (Regra SUS 15 dias)"
              : "Não foi possível agendar",
          message: data.error,
        });
        return;
      }

      onToast({
        type: "success",
        title: "Consulta agendada com sucesso!",
        message: `${selectedSpecialty} em ${formatDateBr(selectedDate)} às ${selectedTime}.`,
      });
      setSelectedTime("");
      await onRefresh();
      await fetchSlots();
    } catch {
      onToast({
        type: "error",
        title: "Erro de conexão",
        message: "Não foi possível conectar ao servidor da Secretaria de Saúde.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(
    apt: Appointment,
    newStatus: "Confirmado" | "Cancelado"
  ) {
    setUpdatingId(apt.id);
    try {
      const res = await fetch(`/api/appointments/${apt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          actorName: activePatient?.name || apt.patient_name,
          actorRole: "Cidadão (Munícipe)",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast({
          type: "error",
          title: "Erro ao atualizar agendamento",
          message: data.error,
        });
        return;
      }

      onToast({
        type: newStatus === "Confirmado" ? "success" : "info",
        title:
          newStatus === "Confirmado"
            ? "Presença confirmada!"
            : "Vaga cancelada e liberada",
        message:
          newStatus === "Confirmado"
            ? `Check-in confirmado para ${apt.specialty} às ${apt.time}.`
            : `O horário de ${apt.time} (${formatDateBr(apt.date)}) voltou imediatamente para a grade disponível.`,
      });
      await onRefresh();
      await fetchSlots();
    } catch {
      onToast({
        type: "error",
        title: "Erro de comunicação",
        message: "Tente novamente em alguns instantes.",
      });
    } finally {
      setUpdatingId(null);
    }
  }

  const statusBadge = (status: Appointment["status"]) => {
    const map: Record<Appointment["status"], string> = {
      Confirmado: "bg-emerald-100 text-emerald-800 border-emerald-300",
      Aguardando: "bg-amber-100 text-amber-800 border-amber-300",
      Realizado: "bg-sky-100 text-[#0F4C81] border-sky-300",
      Faltou: "bg-red-100 text-red-800 border-red-300",
      Cancelado: "bg-slate-100 text-slate-600 border-slate-300 line-through",
    };
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${map[status]}`}
      >
        {status}
      </span>
    );
  };

  const medBadge = (status: Medication["status"]) => {
    if (status === "Disponível") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Disponível
        </span>
      );
    }
    if (status === "Estoque Baixo") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          Estoque Baixo
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300">
        <span className="w-2 h-2 rounded-full bg-red-500" />
        Em Reposição
      </span>
    );
  };

  const qrPayload = activePatient
    ? JSON.stringify({
        sistema: "SAUDE_ALMENARA_DIGITAL",
        cns: activePatient.cns,
        paciente: activePatient.name,
        ubs: patientUbs?.name || activePatient.ubs_id,
      })
    : "";

  return (
    <div className="space-y-6">
      {/* Seletor rápido de cidadão para demonstração */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hc-card">
        <div className="flex items-center gap-2.5">
          <UserCheck className="w-5 h-5 text-[#0F4C81]" />
          <div>
            <p className="text-sm font-semibold">Portal do Cidadão — Almenara/MG</p>
            <p className="text-xs text-slate-500 hc-muted">
              Atendimento humanizado, ágil e transparente pelo SUS
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="citizen-select" className="text-xs font-medium text-slate-600 hc-muted">
            Munícipe ativo:
          </label>
          <select
            id="citizen-select"
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            className="text-sm rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 font-medium focus:outline-none focus:ring-2 focus:ring-[#0F4C81]"
          >
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid Principal Mobile-First */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Coluna Esquerda: Cartão SUS Digital + Meus Agendamentos */}
        <div className="lg:col-span-5 space-y-6">
          {/* Cartão SUS Digital */}
          {activePatient && (
            <section
              aria-label="Cartão SUS Digital"
              className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0F4C81] via-[#135d9e] to-[#0a365c] text-white p-5 shadow-lg hc-card"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-300">
                    <CreditCard className="w-4 h-4" />
                    Cartão Nacional de Saúde (SUS)
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold mt-1.5 leading-snug">
                    {activePatient.name}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQrModal(true)}
                  className="bg-white p-2 rounded-xl shadow-md hover:scale-105 transition-transform shrink-0"
                  title="Ampliar QR Code para Check-in na UBS"
                >
                  <QRCodeSVG value={qrPayload} size={64} level="M" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/15 text-xs">
                <div>
                  <span className="text-sky-200 block">CPF (LGPD)</span>
                  <span className="font-mono text-sm font-semibold tracking-wide">
                    {activePatient.cpf_masked}
                  </span>
                </div>
                <div>
                  <span className="text-sky-200 block">Nº Cartão SUS (CNS)</span>
                  <span className="font-mono text-sm font-semibold tracking-wide">
                    {activePatient.cns}
                  </span>
                </div>
                <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1.5 text-sky-100">
                    <MapPin className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Referência: {patientUbs?.name || "UBS Centro"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowMeuSusModal(true)}
                      className="inline-flex items-center gap-1 text-sky-200 hover:text-white font-semibold underline underline-offset-2"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Sincronizar Meu SUS
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowQrModal(true)}
                      className="inline-flex items-center gap-1 text-emerald-300 hover:text-emerald-200 font-semibold underline underline-offset-2"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      Check-in UBS
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Meus Agendamentos & Fila Transparente */}
          <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hc-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-[#0F4C81]" />
                <h2 className="text-base font-bold">Meus Agendamentos & Fila</h2>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {myAppointments.length} registro(s)
              </span>
            </div>

            {myAppointments.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center hc-muted">
                Você ainda não possui consultas agendadas.
              </p>
            ) : (
              <div className="space-y-3">
                {myAppointments.map((apt) => {
                  const canConfirm = apt.status === "Aguardando";
                  const canCancel =
                    apt.status === "Aguardando" || apt.status === "Confirmado";
                  const isBusy = updatingId === apt.id;

                  return (
                    <div
                      key={apt.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5 hc-card"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            {apt.specialty}
                          </p>
                          <p className="text-xs text-slate-600 flex items-center gap-1 mt-0.5 hc-muted">
                            <MapPin className="w-3.5 h-3.5 text-[#0F4C81]" />
                            {apt.ubs_name}
                          </p>
                        </div>
                        {statusBadge(apt.status)}
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-600 hc-muted">
                        <span className="flex items-center gap-1 font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDateBr(apt.date)} às {apt.time}
                        </span>
                        {apt.is_walkin === 1 && (
                          <span className="px-2 py-0.5 rounded bg-sky-100 text-[#0F4C81] font-semibold">
                            Encaixe Presencial
                          </span>
                        )}
                      </div>

                      {(canConfirm || canCancel) && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {canConfirm && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleStatusChange(apt, "Confirmado")}
                              className="flex-1 min-w-[130px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#10B981] hover:bg-emerald-600 text-white transition-colors disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Confirmar Presença
                            </button>
                          )}
                          {canCancel && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleStatusChange(apt, "Cancelado")}
                              className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-red-300 text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
                            >
                              <XCircle className="w-4 h-4" />
                              Cancelar Vaga
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Cartão de Vacina Digital (Integração Meu SUS Digital / RNDS) */}
          <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hc-card">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <h2 className="text-base font-bold flex items-center gap-2">
                  <Syringe className="w-5 h-5 text-[#10B981]" />
                  Cartão de Vacina Digital
                </h2>
                <p className="text-[11px] text-slate-500 hc-muted">
                  Integração Meu SUS Digital (RNDS / PNI)
                  {activePatient?.cns_synced_at
                    ? ` • Atualizado em ${new Date(activePatient.cns_synced_at).toLocaleDateString("pt-BR")}`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMeuSusModal(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-sky-50 text-[#0F4C81] border border-sky-200 hover:bg-sky-100 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Atualizar CPF
              </button>
            </div>

            {vaccines.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center hc-muted">
                Nenhuma vacina sincronizada. Clique em &ldquo;Atualizar CPF&rdquo; para buscar no Meu SUS Digital.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {vaccines.map((v) => (
                  <div
                    key={v.id}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1 hc-card"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs sm:text-sm font-bold text-slate-900">
                        {v.vaccine_name}
                      </p>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border shrink-0 ${
                          v.status === "Aplicada"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : "bg-amber-100 text-amber-800 border-amber-300"
                        }`}
                      >
                        {v.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 hc-muted">
                      <strong>{v.dose}</strong> • {formatDateBr(v.date_applied)} • Lote:{" "}
                      <span className="font-mono">{v.batch}</span>
                    </p>
                    <p className="text-[11px] text-slate-500 hc-muted">
                      {v.ubs_name} ({v.manufacturer})
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Coluna Direita: Novo Agendamento + Consulta REMUME */}
        <div className="lg:col-span-7 space-y-6">
          {/* Agendamento de Consultas */}
          <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hc-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#10B981]" />
                  Agendamento de Consultas (UBS)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 hc-muted">
                  Escolha a unidade, especialidade e horário disponível em tempo real
                </p>
              </div>
            </div>

            <form onSubmit={handleSchedule} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="ubs-select"
                    className="block text-xs font-semibold text-slate-700 mb-1.5 hc-muted"
                  >
                    Unidade Básica de Saúde (UBS)
                  </label>
                  <select
                    id="ubs-select"
                    value={selectedUbsId}
                    onChange={(e) => setSelectedUbsId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0F4C81]"
                  >
                    {ubsList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.zone})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="specialty-select"
                    className="block text-xs font-semibold text-slate-700 mb-1.5 hc-muted"
                  >
                    Especialidade
                  </label>
                  <select
                    id="specialty-select"
                    value={selectedSpecialty}
                    onChange={(e) => setSelectedSpecialty(e.target.value as Specialty)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0F4C81]"
                  >
                    {SPECIALTIES.map((sp) => (
                      <option key={sp} value={sp}>
                        {sp}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Alerta Proativo da Regra Anti-Duplicidade (15 dias) */}
              {antiDuplicityConflict && (
                <div
                  role="alert"
                  className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-400 text-amber-950"
                >
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs leading-relaxed">
                    <p className="font-bold text-sm">
                      Trava Anti-Duplicidade do SUS Municipal (15 dias)
                    </p>
                    <p className="mt-0.5">
                      Você já possui um agendamento de{" "}
                      <strong>{antiDuplicityConflict.specialty}</strong> em{" "}
                      <strong>{formatDateBr(antiDuplicityConflict.date)}</strong> (
                      {antiDuplicityConflict.ubs_name} — Status:{" "}
                      {antiDuplicityConflict.status}). O sistema municipal bloqueia
                      novos agendamentos na mesma especialidade com intervalo menor
                      que 15 dias para garantir acesso justo a todos os munícipes.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <div>
                  <label
                    htmlFor="date-select"
                    className="block text-xs font-semibold text-slate-700 mb-1.5 hc-muted"
                  >
                    Data da Consulta
                  </label>
                  <input
                    id="date-select"
                    type="date"
                    min={getTodayIso()}
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0F4C81]"
                  />
                </div>
                <div className="sm:col-span-2 text-xs text-slate-500 hc-muted">
                  Horários em verde estão livres. Ao cancelar uma consulta em &ldquo;Meus
                  Agendamentos&rdquo;, a vaga retorna instantaneamente para esta grade.
                </div>
              </div>

              {/* Grade de Horários */}
              <div>
                <span className="block text-xs font-semibold text-slate-700 mb-2 hc-muted">
                  Horários Disponíveis ({formatDateBr(selectedDate)})
                </span>
                {loadingSlots ? (
                  <p className="text-xs text-slate-500 py-3">Carregando grade de horários...</p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {slots.map((slot) => {
                      const isSelected = selectedTime === slot.time;
                      return (
                        <button
                          key={slot.time}
                          type="button"
                          disabled={!slot.available}
                          onClick={() => setSelectedTime(slot.time)}
                          className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
                            !slot.available
                              ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed line-through"
                              : isSelected
                                ? "bg-[#0F4C81] text-white border-[#0F4C81] shadow-sm scale-[1.02]"
                                : "bg-emerald-50/70 text-emerald-900 border-emerald-300 hover:bg-emerald-100"
                          }`}
                        >
                          {slot.time}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || !selectedTime}
                className="w-full py-3 px-4 rounded-xl bg-[#0F4C81] hover:bg-[#0c3d68] text-white font-bold text-sm shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting
                  ? "Registrando Agendamento..."
                  : antiDuplicityConflict
                    ? "Validar Regra SUS e Agendar"
                    : "Confirmar Agendamento na UBS"}
              </button>
            </form>
          </section>

          {/* Consulta de Medicamentos (REMUME) */}
          <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hc-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <Pill className="w-5 h-5 text-[#10B981]" />
                  Farmácia Municipal — Consulta REMUME
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 hc-muted">
                  Disponibilidade em tempo real nas Unidades Básicas de Saúde
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={medQuery}
                  onChange={(e) => setMedQuery(e.target.value)}
                  placeholder="Buscar medicamento ou UBS..."
                  aria-label="Buscar medicamento na REMUME"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]"
                />
              </div>
            </div>

            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto pr-1">
              {filteredMedications.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center hc-muted">
                  Nenhum medicamento encontrado para &ldquo;{medQuery}&rdquo;.
                </p>
              ) : (
                filteredMedications.map((med) => (
                  <div
                    key={med.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-900">{med.name}</p>
                      <p className="text-xs text-slate-500 hc-muted">
                        Princípio ativo: {med.active_ingredient} •{" "}
                        <span className="font-semibold text-[#0F4C81]">
                          {med.ubs_name}
                        </span>
                      </p>
                    </div>
                    <div className="shrink-0">{medBadge(med.status)}</div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Modal QR Code Check-in */}
      {showQrModal && activePatient && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="QR Code para Check-in na UBS"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setShowQrModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl hc-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-[#0F4C81]">
              QR Code de Check-in na UBS
            </h3>
            <p className="text-xs text-slate-600 hc-muted">
              Apresente este código na recepção da unidade para agilizar seu
              atendimento no SUS.
            </p>
            <div className="inline-block p-4 bg-white rounded-2xl border-2 border-slate-200">
              <QRCodeSVG value={qrPayload} size={200} level="H" />
            </div>
            <div className="text-xs text-slate-700 space-y-0.5">
              <p className="font-bold text-sm">{activePatient.name}</p>
              <p className="font-mono">CNS: {activePatient.cns}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="w-full py-2.5 rounded-xl bg-[#0F4C81] text-white font-semibold text-sm hover:bg-[#0c3d68]"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Modal Sincronização Meu SUS Digital por CPF */}
      {showMeuSusModal && activePatient && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Sincronizar com Portal Meu SUS Digital"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setShowMeuSusModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 hc-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-bold text-[#0F4C81] flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-[#10B981]" />
                Integração Portal Meu SUS Digital
              </h3>
              <button
                type="button"
                onClick={() => setShowMeuSusModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed hc-muted">
              Informe o CPF de <strong>{activePatient.name}</strong> para buscar e
              atualizar automaticamente o <strong>Número do Cartão SUS (CNS)</strong>{" "}
              e o <strong>Cartão de Vacinação (RNDS / PNI)</strong>.
            </p>
            <form onSubmit={handleMeuSusSync} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  CPF do Cidadão (11 dígitos)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={syncCpf}
                  onChange={(e) => setSyncCpf(formatCpfInput(e.target.value))}
                  placeholder="000.000.000-00"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0F4C81]"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowMeuSusModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={syncingMeuSus}
                  className="flex-1 py-2.5 rounded-xl bg-[#10B981] hover:bg-emerald-600 text-white text-sm font-bold disabled:opacity-50"
                >
                  {syncingMeuSus ? "Sincronizando..." : "Atualizar via Meu SUS"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
