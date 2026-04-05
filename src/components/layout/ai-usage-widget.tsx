"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, Clock, FlaskConical, RefreshCw, ShoppingBag } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const POLL_MS = 30_000;

interface Props {
  initialUsed:      number;
  initialLimit:     number;
  initialCredits:   number;
  initialTrialing?: boolean;
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

function BucketBar({ used, limit, color }: { used: number; limit: number; color: string }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  return (
    <div className="h-1.5 rounded-full bg-surface-700 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function AiUsageWidget({ initialUsed, initialLimit, initialCredits, initialTrialing = false }: Props) {
  const [used,             setUsed]             = useState(initialUsed);
  const [limit,            setLimit]            = useState(initialLimit);
  const [credits,          setCredits]          = useState(initialCredits);
  const [creditsPurchased, setCreditsPurchased] = useState(initialCredits); // start = initialCredits (best guess)
  const [isTrialing,       setIsTrialing]       = useState(initialTrialing);
  const [open,    setOpen]    = useState(false);
  const [logs,    setLogs]    = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(false);
  const timer  = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  async function refresh() {
    try {
      const res = await fetch("/api/ai/usage");
      if (!res.ok) return;
      const data = await res.json();
      setUsed(data.used);
      setLimit(data.limit);
      setCredits(data.credits);
      setCreditsPurchased(data.creditsPurchased ?? data.credits);
      setIsTrialing(data.isTrialing ?? false);
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

  // Enterprise = truly infinite (limit comes as 999 from API when Infinity)
  // We use 99999 as sentinel — actual enterprise would be very high
  const isEnterprise = !isTrialing && limit >= 999;

  // Summary for the button
  const totalAvailable = isTrialing
    ? Math.max(0, limit - used)                  // trial: remaining trial calls
    : isEnterprise
    ? Infinity
    : Math.max(0, limit - used) + credits;       // paid: remaining monthly + purchased

  const summaryPct = isEnterprise
    ? 0
    : isTrialing
    ? Math.min(100, Math.round((used / limit) * 100))
    : limit > 0 ? Math.min(100, Math.round((used / (limit + credits)) * 100)) : 100;

  const isOut = !isEnterprise && totalAvailable === 0;
  const isLow = !isEnterprise && !isOut && summaryPct >= 80;

  const accentColor = isOut ? "text-red-400" : isLow ? "text-amber-400" : "text-gold-400";
  const barColor    = isOut ? "bg-red-500"   : isLow ? "bg-amber-500"   : "bg-gold-500";

  return (
    <>
      <button
        onClick={handleOpen}
        className="mt-6 mx-1 rounded-lg bg-gold-500/8 border border-gold-500/15 p-3 w-[calc(100%-8px)] text-left hover:bg-gold-500/12 transition-colors"
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <Sparkles className={`h-3.5 w-3.5 ${accentColor}`} />
            <span className={`text-xs font-semibold ${accentColor}`}>
              {isOut ? "IA Esgotada" : isTrialing ? "IA · Trial" : "IA"}
            </span>
          </div>
          <span className={`text-[10px] ${isOut ? "text-red-400" : "text-muted-foreground"}`}>
            {isEnterprise ? "∞" : `${used}/${isTrialing ? limit : limit + credits}`}
          </span>
        </div>

        {!isEnterprise && (
          <div className="h-1 rounded-full bg-surface-700 overflow-hidden mb-1.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${summaryPct}%` }}
            />
          </div>
        )}

        <p className="text-[10px] text-muted-foreground">
          {isEnterprise
            ? "Ilimitado"
            : isOut
            ? "Adicionar créditos →"
            : `${isEnterprise ? "∞" : totalAvailable} chamada${totalAvailable !== 1 ? "s" : ""} restante${totalAvailable !== 1 ? "s" : ""}`}
        </p>
      </button>

      <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) router.refresh(); }}>
        <SheetContent side="right" className="w-80 sm:w-96 flex flex-col gap-0 p-0">
          <SheetHeader className="px-5 py-4 border-b border-border/60">
            <SheetTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-gold-400" />
              Créditos de IA
            </SheetTitle>
          </SheetHeader>

          {/* Buckets */}
          <div className="px-5 py-4 border-b border-border/60 space-y-3">

            {/* Bucket 1: Trial */}
            {isTrialing && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <FlaskConical className="h-3.5 w-3.5 text-gold-400" />
                    <span className="text-xs font-medium text-foreground">Trial</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{Math.max(0, limit - used)} de {limit} restantes</span>
                </div>
                <BucketBar used={used} limit={limit} color={used >= limit ? "bg-red-500" : used / limit >= 0.8 ? "bg-amber-500" : "bg-gold-500"} />
                <p className="text-[10px] text-muted-foreground">Usado apenas durante o período de trial.</p>
              </div>
            )}

            {/* Bucket 2: Plano mensal */}
            {!isTrialing && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5 text-blue-400" />
                    <span className="text-xs font-medium text-foreground">Plano mensal</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {isEnterprise ? "∞" : `${Math.max(0, limit - used)} de ${limit} restantes`}
                  </span>
                </div>
                {!isEnterprise && (
                  <BucketBar used={used} limit={limit} color={used >= limit ? "bg-red-500" : used / limit >= 0.8 ? "bg-amber-500" : "bg-blue-500"} />
                )}
                <p className="text-[10px] text-muted-foreground">Renova todo mês com o plano.</p>
              </div>
            )}

            {/* Bucket 3: Comprados avulso */}
            {credits > 0 ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ShoppingBag className="h-3.5 w-3.5 text-purple-400" />
                    <span className="text-xs font-medium text-foreground">Comprados</span>
                  </div>
                  <span className="text-[11px] text-purple-400 font-semibold">{credits} disponíveis</span>
                </div>
                <BucketBar
                  used={creditsPurchased - credits}
                  limit={Math.max(1, creditsPurchased)}
                  color="bg-purple-500"
                />
                <p className="text-[10px] text-muted-foreground">
                  {isTrialing ? "Ativados quando o trial esgotar." : "Não expiram — ativados quando o plano mensal acabar."}
                </p>
              </div>
            ) : !isTrialing ? (
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <p className="text-[10px] text-muted-foreground">
                  Sem créditos avulsos.{" "}
                  <Link href="/billing" onClick={() => setOpen(false)} className="text-purple-400 hover:underline">Comprar →</Link>
                </p>
              </div>
            ) : null}
          </div>

          {/* History */}
          <div className="px-5 py-3 border-b border-border/40">
            <p className="text-[11px] text-muted-foreground">Últimas chamadas (máx. 50)</p>
          </div>

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
