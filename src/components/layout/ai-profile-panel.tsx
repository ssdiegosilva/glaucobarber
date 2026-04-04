"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Zap, Loader2, Clock, PencilLine, CreditCard, LogOut, Lightbulb } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function formatRelativeLong(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)   return "agora";
  if (mins < 60)  return `${mins}min atrás`;
  if (hours < 24) return `${hours}h atrás`;
  return `${days}d atrás`;
}

interface CallLog {
  id:        string;
  label:     string;
  createdAt: string;
}

interface Props {
  userName:    string;
  open:        boolean;
  onOpenChange: (v: boolean) => void;
}

export function AiProfilePanel({ userName, open, onOpenChange }: Props) {
  const [aiUsed,        setAiUsed]        = useState(0);
  const [aiTotal,       setAiTotal]       = useState(30);
  const [aiTrialing,    setAiTrialing]    = useState(false);
  const [aiCredits,     setAiCredits]     = useState(0);
  const [logs,          setLogs]          = useState<CallLog[]>([]);
  const [loadingLogs,   setLoadingLogs]   = useState(false);
  const [buyingCredits, setBuyingCredits] = useState(false);
  const router   = useRouter();
  const supabase = getSupabaseBrowserClient();

  const loadAiUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/usage");
      if (!res.ok) return;
      const data = await res.json();
      const isTrialing = data.limit >= 999;
      setAiTrialing(isTrialing);
      setAiUsed(isTrialing ? 0 : data.used);
      setAiTotal(isTrialing ? 1 : data.limit + data.credits);
      setAiCredits(isTrialing ? 0 : data.credits);
    } catch {}
  }, []);

  async function loadHistory() {
    setLoadingLogs(true);
    try {
      const res = await fetch("/api/billing/ai-history");
      if (!res.ok) return;
      const data = await res.json();
      setLogs(data.logs ?? []);
    } catch {} finally {
      setLoadingLogs(false);
    }
  }

  useEffect(() => {
    if (open) {
      loadAiUsage();
      loadHistory();
    }
  }, [open, loadAiUsage]);

  async function buyCredits() {
    setBuyingCredits(true);
    try {
      const res = await fetch("/api/billing/credits/checkout", { method: "POST" });
      if (res.redirected) window.location.href = res.url;
    } finally {
      setBuyingCredits(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const pct       = aiTrialing ? 0 : Math.min(100, Math.round((aiUsed / Math.max(1, aiTotal)) * 100));
  const remaining = Math.max(0, aiTotal - aiUsed);
  const isLow     = !aiTrialing && pct >= 80;
  const isOut     = !aiTrialing && pct >= 100;
  const barColor  = isOut ? "bg-red-500" : isLow ? "bg-amber-500" : "bg-gold-500";
  const textColor = isOut ? "text-red-400" : isLow ? "text-amber-400" : "text-gold-400";

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) router.refresh(); }}>
      <SheetContent side="right" className="w-80 sm:w-96 flex flex-col gap-0 p-0 overflow-hidden">

        {/* Header */}
        <SheetHeader className="px-5 py-4 border-b border-border/60 shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-gold-400" />
              Uso de IA
            </SheetTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-500/20 border border-gold-500/30 text-[12px] font-bold text-gold-400 select-none">
              {getInitials(userName)}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{userName}</p>
        </SheetHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* Usage card */}
          <div className="px-5 py-4 border-b border-border/60">
            {aiTrialing ? (
              <div className="rounded-lg bg-gold-500/8 border border-gold-500/20 px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-3.5 w-3.5 text-gold-400" />
                  <span className="text-xs font-semibold text-gold-400">Trial ativo — IA ilimitada</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Aproveite para explorar todas as funcionalidades de IA durante o trial.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Créditos de IA</span>
                  <span className={`text-xs font-bold ${textColor}`}>{aiUsed} / {aiTotal}</span>
                </div>

                <div className="h-2 rounded-full bg-surface-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className={isOut ? "text-red-400 font-medium" : "text-muted-foreground"}>
                    {isOut
                      ? "Limite atingido"
                      : `${remaining} crédito${remaining !== 1 ? "s" : ""} restante${remaining !== 1 ? "s" : ""}`}
                  </span>
                  <span className={textColor}>{pct}%</span>
                </div>

                {aiCredits > 0 && (
                  <p className="text-[11px] text-purple-400">
                    + {aiCredits} crédito{aiCredits !== 1 ? "s" : ""} extra{aiCredits !== 1 ? "s" : ""}
                  </p>
                )}

                <div className="rounded-lg bg-surface-800/60 border border-border/40 px-3 py-2.5 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                    <Lightbulb className="h-3 w-3 text-amber-400 shrink-0" />
                    Como os créditos são consumidos
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Chat, textos e análises</span>
                      <span className="text-foreground font-medium">1 crédito</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Imagem de campanha</span>
                      <span className="text-amber-400 font-semibold">10 créditos</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!aiTrialing && (
              <Button
                onClick={buyCredits}
                disabled={buyingCredits}
                className="mt-3 w-full bg-purple-600 hover:bg-purple-500 text-white text-xs h-8"
              >
                {buyingCredits
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <><Zap className="h-3.5 w-3.5 mr-1.5" />Comprar +60 chamadas — R$29</>
                }
              </Button>
            )}
          </div>

          {/* History */}
          <div className="px-5 pt-4 pb-2">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground">Histórico de uso</span>
              <span className="text-[10px] text-muted-foreground ml-auto">últimas 50</span>
            </div>
          </div>

          {loadingLogs ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 px-5">
              <Sparkles className="h-7 w-7 text-muted-foreground opacity-20" />
              <p className="text-xs text-muted-foreground">Nenhuma chamada registrada ainda</p>
            </div>
          ) : (
            <div className="divide-y divide-border/20 pb-2">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between px-5 py-2.5 gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-1.5 w-1.5 rounded-full bg-gold-400/60 shrink-0" />
                    <span className="text-xs text-foreground truncate">{log.label}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatRelativeLong(log.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border/60 px-5 py-3 shrink-0 space-y-0.5">
          <Link
            href="/settings"
            onClick={() => onOpenChange(false)}
            className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-surface-800 text-sm text-foreground transition-colors"
          >
            <PencilLine className="h-4 w-4 text-muted-foreground" />
            Editar perfil
          </Link>
          <Link
            href="/billing"
            onClick={() => onOpenChange(false)}
            className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-surface-800 text-sm text-foreground transition-colors"
          >
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            Ver plano e cobrança
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-surface-800 text-sm text-left text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4 text-muted-foreground" />
            Sair
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
