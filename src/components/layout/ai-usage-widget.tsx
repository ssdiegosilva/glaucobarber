"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles, Loader2, Clock } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const POLL_MS = 30_000;

interface Props {
  initialUsed:    number;
  initialLimit:   number;
  initialCredits: number;
}

interface CallLog {
  id:        string;
  label:     string;
  createdAt: string;
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)   return "agora";
  if (mins < 60)  return `${mins}min atrás`;
  if (hours < 24) return `${hours}h atrás`;
  return `${days}d atrás`;
}

export function AiUsageWidget({ initialUsed, initialLimit, initialCredits }: Props) {
  const [used,    setUsed]    = useState(initialUsed);
  const [limit,   setLimit]   = useState(initialLimit);
  const [credits, setCredits] = useState(initialCredits);
  const [open,    setOpen]    = useState(false);
  const [logs,    setLogs]    = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/ai/usage");
      if (!res.ok) return;
      const data = await res.json();
      setUsed(data.used);
      setLimit(data.limit);
      setCredits(data.credits);
    } catch {}
  }

  async function loadHistory() {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/ai-history");
      if (!res.ok) return;
      const data = await res.json();
      setLogs(data.logs ?? []);
    } catch {} finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    timer.current = setInterval(refresh, POLL_MS);
    window.addEventListener("ai-used", refresh);
    return () => {
      if (timer.current) clearInterval(timer.current);
      window.removeEventListener("ai-used", refresh);
    };
  }, []);

  function handleOpen() {
    setOpen(true);
    loadHistory();
  }

  const total     = limit + credits;
  const pct       = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 100;
  const remaining = Math.max(0, total - used);
  const isLow     = pct >= 80;
  const isOut     = pct >= 100;
  const isInfinite = limit === Infinity || limit > 900;

  return (
    <>
      <button
        onClick={handleOpen}
        className="mt-6 mx-1 rounded-lg bg-gold-500/8 border border-gold-500/15 p-3 w-[calc(100%-8px)] text-left hover:bg-gold-500/12 transition-colors"
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <Sparkles className={`h-3.5 w-3.5 ${isOut ? "text-red-400" : isLow ? "text-amber-400" : "text-gold-400"}`} />
            <span className={`text-xs font-semibold ${isOut ? "text-red-400" : isLow ? "text-amber-400" : "text-gold-400"}`}>
              {isOut ? "IA Esgotada" : "IA"}
            </span>
          </div>
          <span className={`text-[10px] ${isOut ? "text-red-400" : "text-muted-foreground"}`}>
            {isInfinite ? "∞" : `${used}/${total}`}
          </span>
        </div>
        {!isInfinite && (
          <div className="h-1 rounded-full bg-surface-700 overflow-hidden mb-1.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${isOut ? "bg-red-500" : isLow ? "bg-amber-500" : "bg-gold-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
        <p className="text-[10px] text-muted-foreground">
          {isInfinite
            ? "Trial — IA disponível"
            : isOut
            ? "Adicionar créditos →"
            : `${remaining} chamada${remaining !== 1 ? "s" : ""} restante${remaining !== 1 ? "s" : ""}`}
        </p>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-80 sm:w-96 flex flex-col gap-0 p-0">
          <SheetHeader className="px-5 py-4 border-b border-border/60">
            <SheetTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-gold-400" />
              Histórico de uso de IA
            </SheetTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Últimas chamadas registradas (máx. 30)
            </p>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm gap-2">
                <Sparkles className="h-8 w-8 opacity-20" />
                <p>Nenhuma chamada registrada</p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between px-5 py-3 gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-1.5 w-1.5 rounded-full bg-gold-400 shrink-0" />
                      <span className="text-sm text-foreground truncate">{log.label}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                      <Clock className="h-3 w-3" />
                      {formatRelative(log.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-5 py-4 border-t border-border/60">
            <Link
              href="/billing"
              onClick={() => setOpen(false)}
              className="block w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Ver plano e cobrança →
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
