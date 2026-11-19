"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  Appointment,
  AuthUser,
  BiStats,
  Medication,
  Patient,
  UbsUnit,
  UserRole,
} from "@/lib/types";
import { TopHeader } from "./TopHeader";
import { CitizenPortal } from "./CitizenPortal";
import { ReceptionPanel } from "./ReceptionPanel";
import { ManagementPanel } from "./ManagementPanel";
import { AuthGate } from "./AuthGate";
import { ToastContainer, type ToastItem } from "./ToastContainer";

export function SaudeAlmenaraApp() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<UserRole>("cidadao");
  const [largeFont, setLargeFont] = useState(false);
  const [highContrast, setHighContrast] = useState(false);

  const [ubsList, setUbsList] = useState<UbsUnit[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [bi, setBi] = useState<BiStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((toast: Omit<ToastItem, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const [ubsRes, aptRes, medRes, biRes] = await Promise.all([
        fetch("/api/ubs"),
        fetch("/api/appointments"),
        fetch("/api/medications"),
        fetch("/api/bi"),
      ]);

      const [ubsData, aptData, medData, biData] = await Promise.all([
        ubsRes.json(),
        aptRes.json(),
        medRes.json(),
        biRes.json(),
      ]);

      if (ubsRes.ok) {
        setUbsList(ubsData.ubs || []);
        setPatients(ubsData.patients || []);
      }
      if (aptRes.ok) {
        setAppointments(aptData.appointments || []);
      }
      if (medRes.ok) {
        setMedications(medData.medications || []);
      }
      if (biRes.ok) {
        setBi(biData);
      }
    } catch {
      addToast({
        type: "error",
        title: "Erro ao carregar dados",
        message: "Verifique se o servidor Next.js está ativo.",
      });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadAll();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadAll]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("large-font", largeFont);
    root.classList.toggle("high-contrast", highContrast);
  }, [largeFont, highContrast]);

  function handleRoleChange(nextRole: UserRole) {
    setRole(nextRole);
    const labelMap: Record<UserRole, string> = {
      cidadao: "Portal do Cidadão (Munícipe)",
      recepcao: "Painel Operacional (Recepção / Farmácia)",
      gestao: "Painel de Gestão Pública & Auditoria (BI)",
    };
    addToast({
      type: "info",
      title: `Perfil alterado: ${labelMap[nextRole]}`,
    });
  }

  function handleAuthenticated(user: AuthUser) {
    setAuthUser(user);
    setRole(user.role);
    void loadAll();
  }

  function handleLogout() {
    setAuthUser(null);
    addToast({
      type: "info",
      title: "Sessão encerrada",
      message: "Selecione um perfil para entrar novamente.",
    });
  }

  if (!authUser) {
    return (
      <>
        <AuthGate
          ubsList={ubsList}
          onAuthenticated={handleAuthenticated}
          onToast={addToast}
        />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <TopHeader
        role={role}
        userName={authUser.name}
        onRoleChange={handleRoleChange}
        onLogout={handleLogout}
        largeFont={largeFont}
        onToggleLargeFont={() => setLargeFont((v) => !v)}
        highContrast={highContrast}
        onToggleHighContrast={() => setHighContrast((v) => !v)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm hc-card">
            <div className="w-8 h-8 border-4 border-[#0F4C81] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">
              Inicializando Saúde Almenara Digital...
            </p>
            <p className="text-xs text-slate-500 mt-1 hc-muted">
              Carregando unidades UBS, REMUME e indicadores do SUS municipal
            </p>
          </div>
        ) : (
          <>
            {role === "cidadao" && (
              <CitizenPortal
                ubsList={ubsList}
                patients={patients}
                appointments={appointments}
                medications={medications}
                initialPatientId={authUser.patient_id}
                onRefresh={loadAll}
                onToast={addToast}
              />
            )}

            {role === "recepcao" && (
              <ReceptionPanel
                ubsList={ubsList}
                appointments={appointments}
                medications={medications}
                onRefresh={loadAll}
                onToast={addToast}
              />
            )}

            {role === "gestao" && (
              <ManagementPanel
                bi={bi}
                ubsList={ubsList}
                appointments={appointments}
                onRefresh={loadAll}
                onToast={addToast}
              />
            )}
          </>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-5 px-4 text-center text-xs text-slate-500 hc-surface hc-muted">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-almenara.png"
            alt="Prefeitura de Almenara - Trabalhando para Todos"
            className="h-10 w-auto object-contain bg-white rounded-lg px-2 py-1"
          />
          <div className="sm:text-left">
            <p className="font-semibold text-slate-700">
              Saúde Almenara Digital • Secretaria Municipal de Saúde de Almenara/MG
            </p>
            <p className="mt-0.5">
              Sistema Único de Saúde (SUS) — Atenção Primária, Farmácia REMUME e Governança LGPD/TCE-MG
            </p>
          </div>
        </div>
      </footer>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
