"use client";

import { AlertTriangle, CheckCircle, Info, X, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

type ToastItem = { id: number; message: string; kind: string };

const ICONS: Record<string, any> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
};

const TONES: Record<string, string> = {
  info: "text-primary",
  success: "text-success",
  warning: "text-warning",
  error: "text-destructive",
};

/**
 * Global toast host — listens for `toast()` events (lib/toast.ts) and
 * renders a small auto-dismissing stack. Mounted once in the root layout.
 */
export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const dismiss = (id: number) =>
      setItems((prev) => prev.filter((t) => t.id !== id));

    const onToast = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const id = Date.now() + Math.random();
      setItems((prev) => [
        // Cap the stack at 3 so a flurry of events can't bury the screen
        ...prev.slice(-2),
        { id, message: detail.message || "", kind: detail.kind || "info" },
      ]);
      setTimeout(() => dismiss(id), 5000);
    };

    window.addEventListener("corpersafe:toast", onToast);
    return () => window.removeEventListener("corpersafe:toast", onToast);
  }, []);

  return (
    <div className="fixed top-4 inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-sm z-[100] flex flex-col gap-2 pointer-events-none">
      {items.map((t) => {
        const Icon = ICONS[t.kind] ?? Info;
        return (
          <div
            key={t.id}
            role="status"
            aria-live="polite"
            className="pointer-events-auto bg-card border border-border shadow-2xl rounded-xl p-3 flex items-start gap-3 animate-in slide-in-from-top-4"
          >
            <Icon
              size={18}
              className={`${TONES[t.kind] ?? TONES.info} shrink-0 mt-0.5`}
            />
            <p className="text-sm font-medium flex-1 whitespace-pre-line">
              {t.message}
            </p>
            <button
              onClick={() =>
                setItems((prev) => prev.filter((x) => x.id !== t.id))
              }
              aria-label="Dismiss notification"
              className="shrink-0 text-muted-foreground hover:text-foreground rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
