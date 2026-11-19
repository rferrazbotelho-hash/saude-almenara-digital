"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

export interface ToastItem {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message?: string;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  const styles = {
    success: "bg-emerald-50 border-emerald-500 text-emerald-950",
    error: "bg-red-50 border-red-500 text-red-950",
    warning: "bg-amber-50 border-amber-500 text-amber-950",
    info: "bg-sky-50 border-[#0F4C81] text-slate-900",
  };

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />,
    error: <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />,
    warning: <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />,
    info: <Info className="w-5 h-5 text-[#0F4C81] shrink-0 mt-0.5" />,
  };

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] sm:w-full"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          className={`flex items-start gap-3 p-3.5 rounded-xl border-l-4 shadow-lg transition-all ${styles[t.type]}`}
        >
          {icons[t.type]}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-snug">{t.title}</p>
            {t.message && (
              <p className="text-xs mt-0.5 opacity-90 leading-relaxed">{t.message}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            aria-label="Fechar notificação"
            className="p-1 rounded-md hover:bg-black/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
