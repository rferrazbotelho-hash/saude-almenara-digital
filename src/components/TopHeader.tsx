"use client";

import {
  BarChart3,
  Contrast,
  LogOut,
  ShieldCheck,
  Stethoscope,
  Type,
  User,
} from "lucide-react";
import type { UserRole } from "@/lib/types";

interface TopHeaderProps {
  role: UserRole;
  userName?: string;
  onRoleChange: (role: UserRole) => void;
  onLogout: () => void;
  largeFont: boolean;
  onToggleLargeFont: () => void;
  highContrast: boolean;
  onToggleHighContrast: () => void;
}

export function TopHeader({
  role,
  userName,
  onRoleChange,
  onLogout,
  largeFont,
  onToggleLargeFont,
  highContrast,
  onToggleHighContrast,
}: TopHeaderProps) {
  const roles: Array<{
    id: UserRole;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
  }> = [
    {
      id: "cidadao",
      label: "Cidadão (Munícipe)",
      shortLabel: "Cidadão",
      icon: <User className="w-4 h-4" />,
    },
    {
      id: "recepcao",
      label: "Recepção / Farmácia",
      shortLabel: "Recepção",
      icon: <Stethoscope className="w-4 h-4" />,
    },
    {
      id: "gestao",
      label: "Gestão Pública (BI)",
      shortLabel: "Gestão BI",
      icon: <BarChart3 className="w-4 h-4" />,
    },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#0F4C81] text-white shadow-md hc-surface">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Identidade Institucional */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-white rounded-xl px-2 py-1 shadow-sm shrink-0 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo-almenara.png"
                  alt="Prefeitura de Almenara - Trabalhando para Todos"
                  className="h-9 w-auto object-contain"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-bold tracking-tight leading-tight">
                    Saúde Almenara Digital
                  </h1>
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/15 text-emerald-200 border border-white/20">
                    <ShieldCheck className="w-3 h-3" />
                    SUS
                  </span>
                </div>
                <p className="text-xs text-sky-100/90 hc-muted">
                  Secretaria Municipal de Saúde • Prefeitura de Almenara/MG
                </p>
              </div>
            </div>

            {/* Acessibilidade Mobile */}
            <div className="flex lg:hidden items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleLargeFont}
                aria-pressed={largeFont}
                title="Aumentar Fonte (A+)"
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 border transition-colors ${
                  largeFont
                    ? "bg-amber-400 text-slate-950 border-amber-300"
                    : "bg-white/10 text-white border-white/25 hover:bg-white/20"
                }`}
              >
                <Type className="w-3.5 h-3.5" />
                A+
              </button>
              <button
                type="button"
                onClick={onToggleHighContrast}
                aria-pressed={highContrast}
                title="Alto Contraste"
                className={`p-1.5 rounded-lg border transition-colors ${
                  highContrast
                    ? "bg-amber-400 text-slate-950 border-amber-300"
                    : "bg-white/10 text-white border-white/25 hover:bg-white/20"
                }`}
              >
                <Contrast className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onLogout}
                title="Sair / Trocar Login"
                className="p-1.5 rounded-lg border bg-white/10 text-white border-white/25 hover:bg-red-500/80 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Seletor Rápido de Perfil (RBAC) + Acessibilidade Desktop */}
          <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2.5">
            <nav
              aria-label="Seletor de Perfil RBAC"
              className="flex items-center bg-slate-950/25 p-1 rounded-xl border border-white/15 w-full sm:w-auto"
            >
              {roles.map((r) => {
                const active = role === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onRoleChange(r.id)}
                    aria-current={active ? "page" : undefined}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                      active
                        ? "bg-white text-[#0F4C81] shadow-sm font-semibold"
                        : "text-sky-100 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {r.icon}
                    <span className="hidden md:inline">{r.label}</span>
                    <span className="md:hidden">{r.shortLabel}</span>
                  </button>
                );
              })}
            </nav>

            <div className="hidden lg:flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleLargeFont}
                aria-pressed={largeFont}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-colors ${
                  largeFont
                    ? "bg-amber-400 text-slate-950 border-amber-300"
                    : "bg-white/10 text-white border-white/25 hover:bg-white/20"
                }`}
              >
                <Type className="w-4 h-4" />
                Aumentar Fonte (A+)
              </button>
              <button
                type="button"
                onClick={onToggleHighContrast}
                aria-pressed={highContrast}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-colors ${
                  highContrast
                    ? "bg-amber-400 text-slate-950 border-amber-300"
                    : "bg-white/10 text-white border-white/25 hover:bg-white/20"
                }`}
              >
                <Contrast className="w-4 h-4" />
                Alto Contraste
              </button>
              <button
                type="button"
                onClick={onLogout}
                title={userName ? `Sair (${userName})` : "Sair / Trocar Login"}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border bg-white/10 text-white border-white/25 hover:bg-red-600 hover:border-red-500 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
