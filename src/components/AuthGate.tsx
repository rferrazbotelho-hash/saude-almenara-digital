"use client";

import { useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LocateFixed,
  LogIn,
  MapPin,
  Phone,
  ShieldCheck,
  Stethoscope,
  User,
  UserPlus,
} from "lucide-react";
import type { AuthUser, UbsUnit, UserRole } from "@/lib/types";
import type { ToastItem } from "./ToastContainer";

interface AuthGateProps {
  ubsList: UbsUnit[];
  onAuthenticated: (user: AuthUser) => void;
  onToast: (toast: Omit<ToastItem, "id">) => void;
}

function formatCpf(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

const DEMO_CREDENTIALS: Record<UserRole, { cpf: string; password: string; hint: string }> = {
  cidadao: {
    cpf: "123.456.789-00",
    password: "123456",
    hint: "Maria Aparecida dos Santos",
  },
  recepcao: {
    cpf: "111.222.333-44",
    password: "123456",
    hint: "Carla Mendes (UBS Centro)",
  },
  gestao: {
    cpf: "999.888.777-66",
    password: "123456",
    hint: "Dr. Ricardo Almeida (Secretário)",
  },
};

export function AuthGate({ ubsList, onAuthenticated, onToast }: AuthGateProps) {
  const [mode, setMode] = useState<"login" | "register">("login");

  // Login state
  const [loginRole, setLoginRole] = useState<UserRole>("cidadao");
  const [loginCpf, setLoginCpf] = useState("123.456.789-00");
  const [loginPassword, setLoginPassword] = useState("123456");
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  // Register state
  const [regName, setRegName] = useState("");
  const [regCpf, setRegCpf] = useState("");
  const [regCns, setRegCns] = useState("");
  const [cnsSource, setCnsSource] = useState<string | null>(null);
  const [loadingCns, setLoadingCns] = useState(false);
  const [regAddress, setRegAddress] = useState("");
  const [regLat, setRegLat] = useState<number | null>(null);
  const [regLng, setRegLng] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [regUbsId, setRegUbsId] = useState(ubsList[0]?.id || "ubs-centro");
  const [regWhatsapp, setRegWhatsapp] = useState("");
  const [regEmergencyName, setRegEmergencyName] = useState("");
  const [regEmergencyPhone, setRegEmergencyPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPass, setShowRegPass] = useState(false);
  const [registering, setRegistering] = useState(false);

  async function handleRegCpfChange(raw: string) {
    const formatted = formatCpf(raw);
    setRegCpf(formatted);
    const digits = formatted.replace(/\D/g, "");

    if (digits.length !== 11) {
      setRegCns("");
      setCnsSource(null);
      setLoadingCns(false);
      return;
    }

    setLoadingCns(true);
    try {
      const res = await fetch(`/api/auth/cadsus?cpf=${digits}`);
      const data = await res.json();
      if (res.ok && data.cns) {
        setRegCns(data.cns);
        setCnsSource(data.source || "Integração Automática Portal CADSUS");
      }
    } catch {
      // ignore transient error
    } finally {
      setLoadingCns(false);
    }
  }

  function handleSelectRole(nextRole: UserRole) {
    setLoginRole(nextRole);
    const demo = DEMO_CREDENTIALS[nextRole];
    setLoginCpf(demo.cpf);
    setLoginPassword(demo.password);
  }

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoggingIn(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: loginRole,
          cpf: loginCpf,
          password: loginPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast({
          type: "error",
          title: "Falha na autenticação",
          message: data.error,
        });
        return;
      }

      onToast({
        type: "success",
        title: `Bem-vindo(a), ${data.user.name}!`,
        message: "Acesso autorizado ao Saúde Almenara Digital.",
      });
      onAuthenticated(data.user);
    } catch {
      onToast({
        type: "error",
        title: "Erro de conexão",
        message: "Não foi possível validar suas credenciais.",
      });
    } finally {
      setLoggingIn(false);
    }
  }

  function handleGeolocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      onToast({
        type: "warning",
        title: "Geolocalização indisponível",
        message: "Seu navegador não suporta GPS. Preencha o endereço manualmente.",
      });
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setRegLat(lat);
        setRegLng(lng);

        try {
          const resp = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=pt-BR`
          );
          if (resp.ok) {
            const geo = await resp.json();
            if (geo.display_name) {
              setRegAddress(geo.display_name);
              onToast({
                type: "success",
                title: "Endereço localizado via GPS!",
                message: "Confira o endereço preenchido e a UBS de referência.",
              });
              setLocating(false);
              return;
            }
          }
        } catch {
          // Fallback caso sem internet ou bloqueio Nominatim
        }

        setRegAddress(
          `Almenara/MG (Coordenadas GPS: ${lat}, ${lng}) — Complementar rua e número`
        );
        onToast({
          type: "info",
          title: "Coordenadas capturadas via GPS",
          message: `Latitude ${lat}, Longitude ${lng}. Complete com rua e número.`,
        });
        setLocating(false);
      },
      () => {
        setLocating(false);
        onToast({
          type: "warning",
          title: "Permissão de localização negada",
          message: "Autorize o GPS no navegador ou digite seu endereço completo.",
        });
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  async function handleRegisterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setRegistering(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: regName,
          cpf: regCpf,
          password: regPassword,
          address: regAddress,
          latitude: regLat,
          longitude: regLng,
          ubsId: regUbsId,
          cns: regCns,
          whatsapp: regWhatsapp,
          emergencyContactName: regEmergencyName,
          emergencyContactPhone: regEmergencyPhone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast({
          type: "error",
          title: "Não foi possível concluir o cadastro",
          message: data.error,
        });
        return;
      }

      onToast({
        type: "success",
        title: "Cadastro realizado com sucesso!",
        message: `Cartão SUS ${data.user.cns} vinculado ao seu CPF.`,
      });
      onAuthenticated(data.user);
    } catch {
      onToast({
        type: "error",
        title: "Erro de conexão",
        message: "Não foi possível salvar seu cadastro.",
      });
    } finally {
      setRegistering(false);
    }
  }

  const roleCards: Array<{
    id: UserRole;
    title: string;
    desc: string;
    icon: React.ReactNode;
  }> = [
    {
      id: "cidadao",
      title: "Usuário",
      desc: "Cidadão / Munícipe",
      icon: <User className="w-5 h-5" />,
    },
    {
      id: "recepcao",
      title: "Recepção / Farmácia",
      desc: "Operacional UBS",
      icon: <Stethoscope className="w-5 h-5" />,
    },
    {
      id: "gestao",
      title: "Gestão",
      desc: "Secretaria & BI",
      icon: <BarChart3 className="w-5 h-5" />,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F4C81] via-[#125894] to-[#0b3961] flex flex-col items-center justify-center p-4 py-8">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-white/20">
        {/* Topo Institucional com Logo Oficial */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-almenara.png"
              alt="Prefeitura de Almenara - Trabalhando para Todos"
              className="h-12 w-auto object-contain"
            />
            <div>
              <h1 className="text-lg font-extrabold text-[#0F4C81] leading-tight">
                Saúde Almenara Digital
              </h1>
              <p className="text-xs text-slate-600">
                Secretaria Municipal de Saúde • Acesso Unificado SUS
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <ShieldCheck className="w-3.5 h-3.5" />
            Portal Seguro
          </span>
        </div>

        {/* Alternador Login / Cadastro */}
        <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-100/70 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              mode === "login"
                ? "bg-white text-[#0F4C81] shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <LogIn className="w-4 h-4" />
            Entrar (Login)
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              mode === "register"
                ? "bg-white text-[#10B981] shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <UserPlus className="w-4 h-4" />
            Cadastrar-se
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6">
          {mode === "login" ? (
            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <div>
                <span className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  1. Selecione seu Perfil de Acesso
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {roleCards.map((rc) => {
                    const active = loginRole === rc.id;
                    return (
                      <button
                        key={rc.id}
                        type="button"
                        onClick={() => handleSelectRole(rc.id)}
                        className={`p-3 rounded-2xl border text-left transition-all flex sm:flex-col items-center sm:items-start gap-3 sm:gap-1.5 ${
                          active
                            ? "border-[#0F4C81] bg-sky-50/90 text-[#0F4C81] ring-2 ring-[#0F4C81]/20"
                            : "border-slate-200 hover:border-slate-300 text-slate-700"
                        }`}
                      >
                        <div
                          className={`p-2 rounded-xl ${
                            active ? "bg-[#0F4C81] text-white" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {rc.icon}
                        </div>
                        <div>
                          <p className="text-sm font-bold leading-tight">{rc.title}</p>
                          <p className="text-[11px] opacity-80">{rc.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label
                    htmlFor="login-cpf"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    CPF
                  </label>
                  <input
                    id="login-cpf"
                    type="text"
                    inputMode="numeric"
                    required
                    value={loginCpf}
                    onChange={(e) => setLoginCpf(formatCpf(e.target.value))}
                    placeholder="000.000.000-00"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0F4C81]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showLoginPass ? "text" : "password"}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Digite sua senha"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPass((v) => !v)}
                      aria-label="Mostrar ou ocultar senha"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      {showLoginPass ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
                <p className="font-semibold text-slate-800">
                  Credenciais de Demonstração ({roleCards.find((r) => r.id === loginRole)?.title}):
                </p>
                <p className="mt-0.5 font-mono">
                  CPF: {DEMO_CREDENTIALS[loginRole].cpf} • Senha:{" "}
                  {DEMO_CREDENTIALS[loginRole].password} ({DEMO_CREDENTIALS[loginRole].hint})
                </p>
              </div>

              <button
                type="submit"
                disabled={loggingIn}
                className="w-full py-3 rounded-xl bg-[#0F4C81] hover:bg-[#0c3d68] text-white font-bold text-sm shadow-md transition-colors disabled:opacity-50"
              >
                {loggingIn ? "Autenticando..." : "Entrar no Sistema"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Ex: Fernanda Oliveira Santos"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    CPF *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={regCpf}
                    onChange={(e) => void handleRegCpfChange(e.target.value)}
                    placeholder="000.000.000-00"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0F4C81]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cartão SUS (CNS — Automático)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      value={
                        loadingCns
                          ? "Consultando Portal CADSUS..."
                          : regCns || "Digite o CPF completo..."
                      }
                      className="w-full rounded-xl border border-emerald-300 bg-emerald-50/60 px-3 py-2 text-sm font-mono font-semibold text-emerald-950"
                    />
                    {loadingCns && (
                      <Loader2 className="w-4 h-4 text-[#0F4C81] animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                    )}
                  </div>
                  {cnsSource && (
                    <p className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 mt-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {cnsSource}
                    </p>
                  )}
                </div>
              </div>

              {/* Endereço Completo + Auxiliar de Geolocalização */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Endereço Completo *
                  </label>
                  <button
                    type="button"
                    onClick={handleGeolocation}
                    disabled={locating}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#0F4C81] hover:underline disabled:opacity-50"
                  >
                    {locating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <LocateFixed className="w-3.5 h-3.5" />
                    )}
                    {locating ? "Localizando..." : "Usar Geolocalização (GPS)"}
                  </button>
                </div>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={regAddress}
                    onChange={(e) => setRegAddress(e.target.value)}
                    placeholder="Rua, número, bairro — Almenara/MG"
                    className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]"
                  />
                </div>
                {regLat !== null && regLng !== null && (
                  <p className="text-[11px] text-slate-500 mt-1 font-mono">
                    GPS capturado: {regLat}, {regLng}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    UBS de Referência
                  </label>
                  <select
                    value={regUbsId}
                    onChange={(e) => setRegUbsId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
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
                    Telefone / WhatsApp *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-emerald-600 absolute left-3 top-2.5" />
                    <input
                      type="tel"
                      required
                      value={regWhatsapp}
                      onChange={(e) => setRegWhatsapp(formatPhone(e.target.value))}
                      placeholder="(33) 99999-9999"
                      className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0F4C81]"
                    />
                  </div>
                </div>
              </div>

              {/* Contato de Emergência */}
              <div className="rounded-2xl bg-amber-50/70 border border-amber-200 p-3.5 space-y-2.5">
                <p className="text-xs font-bold text-amber-900">
                  Contato de Emergência
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Nome do Contato *
                    </label>
                    <input
                      type="text"
                      required
                      value={regEmergencyName}
                      onChange={(e) => setRegEmergencyName(e.target.value)}
                      placeholder="Nome completo"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Telefone do Contato *
                    </label>
                    <input
                      type="tel"
                      required
                      value={regEmergencyPhone}
                      onChange={(e) =>
                        setRegEmergencyPhone(formatPhone(e.target.value))
                      }
                      placeholder="(33) 99999-9999"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Senha */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Crie uma Senha de Acesso (mín. 4 caracteres) *
                </label>
                <div className="relative">
                  <input
                    type={showRegPass ? "text" : "password"}
                    required
                    minLength={4}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Crie sua senha"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    {showRegPass ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={registering}
                className="w-full py-3 rounded-xl bg-[#10B981] hover:bg-emerald-600 text-white font-bold text-sm shadow-md transition-colors disabled:opacity-50"
              >
                {registering
                  ? "Salvando Cadastro SUS..."
                  : "Concluir Cadastro e Acessar Portal"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
