"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Zap, Loader2, Clock, PencilLine, CreditCard, LogOut, Lightbulb, ChevronDown, ChevronUp, Lock } from "lucide-react";
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
  credits:   number;
  source:    string;
  createdAt: string;
}

interface Props {
  userName:    string;
  open:        boolean;
  onOpenChange: (v: boolean) => void;
}

export function AiProfilePanel({ userName, open, onOpenChange }: Props) {
  const [aiUsed,             setAiUsed]             = useState(0);
  const [aiTotal,            setAiTotal]            = useState(30);
  const [aiTrialing,         setAiTrialing]         = useState(false);
  const [aiCredits,          setAiCredits]          = useState(0);
  const [aiCreditsPurchased, setAiCreditsPurchased] = useState(0);
  const [planTier,           setPlanTier]           = useState<string>("FREE");
  const [logs,          setLogs]          = useState<CallLog[]>([]);
  const [loadingLogs,   setLoadingLogs]   = useState(false);
  const [historyOpen,   setHistoryOpen]   = useState(false);
  const [hasMore,       setHasMore]       = useState(false);
  const [loadingMore,   setLoadingMore]   = useState(false);
  const [buyingCredits, setBuyingCredits] = useState(false);
  const router   = useRouter();
  const supabase = getSupabaseBrowserClient();

  const loadAiUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/usage");
      if (!res.ok) return;
      const data = await res.json();
      setAiTrialing(data.isTrialing ?? false);
      setAiUsed(data.used);
      setAiTotal(data.limit);
      setAiCredits(data.credits);
      setAiCreditsPurchased(data.creditsPurchased ?? 0);
      setPlanTier(data.planTier ?? "FREE");
    } catch {}
  }, []);

  async function loadHistory() {
    setHistoryOpen(true);
    setLoadingLogs(true);
    try {
      const res = await fetch("/api/billing/ai-history?skip=0");
      if (!res.ok) return;
      const data = await res.json();
      setLogs(data.logs ?? []);
      setHasMore(data.hasMore ?? false);
    } catch {} finally {
      setLoadingLogs(false);
    }
  }

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/billing/ai-history?skip=${logs.length}`);
      if (!res.ok) return;
      const data = await res.json();
      setLogs((prev) => [...prev, ...(data.logs ?? [])]);
      setHasMore(data.hasMore ?? false);
    } catch {} finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    if (open) {
      loadAiUsage();
    } else {
      // reset history when panel closes so next open starts fresh
      setHistoryOpen(false);
      setLogs([]);
      setHasMore(false);
    }
  }, [open, loadAiUsage]);

  async function buyCredits() {
    setBuyingCredits(true);
    try {
      const res  = await fetch("/api/billing/credits/checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
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
          <div className="px-5 py-4 border-b border-border/60 space-y-3">

            {/* Balde 1: Trial */}
            {aiTrialing && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gold-400">Trial</span>
                  <span className="text-[11px] text-muted-foreground">{Math.max(0, aiTotal - aiUsed)} de {aiTotal} restantes</span>
                </div>
                <div className="h-2 rounded-full bg-surface-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${aiUsed >= aiTotal ? "bg-red-500" : aiUsed / aiTotal >= 0.8 ? "bg-amber-500" : "bg-gold-500"}`}
                    style={{ width: `${Math.min(100, Math.round((aiUsed / Math.max(1, aiTotal)) * 100))}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">Usado durante o período de trial.</p>
              </div>
            )}

            {/* Balde 2: Plano mensal — FREE mostra aviso de upgrade, outros mostram barra */}
            {!aiTrialing && planTier === "FREE" && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span className="text-xs font-semibold text-amber-400">Plano Free — sem créditos mensais</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  O plano Free não inclui créditos mensais de IA. Você pode comprar créditos avulsos para usar nas funcionalidades disponíveis, ou fazer upgrade para ter acesso completo.
                </p>
                <Link
                  href="/billing"
                  onClick={() => onOpenChange(false)}
                  className="flex items-center justify-center gap-1.5 w-full rounded-md bg-gold-500/15 border border-gold-500/30 px-3 py-1.5 text-[11px] font-semibold text-gold-400 hover:bg-gold-500/25 transition-colors"
                >
                  <Sparkles className="h-3 w-3" />
                  Ver planos e fazer upgrade
                </Link>
              </div>
            )}

            {!aiTrialing && planTier !== "FREE" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Plano mensal</span>
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
                    {isOut ? "Limite atingido" : `${remaining} restante${remaining !== 1 ? "s" : ""}`}
                  </span>
                  <span className={textColor}>{pct}%</span>
                </div>
              </div>
            )}

            {/* Balde 3: Comprados avulso */}
            {aiCredits > 0 && (
              <div className="space-y-1.5 border-t border-border/40 pt-2">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Zap className="h-3 w-3 text-purple-400" />
                    <span>Comprados</span>
                  </div>
                  <span className="text-purple-400 font-semibold">{aiCredits} disponíveis</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-purple-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.round(((aiCreditsPurchased - aiCredits) / Math.max(1, aiCreditsPurchased)) * 100))}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {aiTrialing ? "Ativados quando o trial esgotar." : "Não expiram — ativados quando o plano mensal acabar."}
                </p>
              </div>
            )}

            {/* Custo por ação (só fora do trial) */}
            {!aiTrialing && (
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
                  <div className="flex items-start justify-between text-[10px] text-muted-foreground gap-2">
                    <span>Imagem de campanha</span>
                    <span className="text-amber-400 font-semibold text-right shrink-0">varia pela qualidade<br/>escolhida</span>
                  </div>
                </div>
              </div>
            )}

            <Button
              onClick={buyCredits}
              disabled={buyingCredits}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white text-xs h-8"
            >
              {buyingCredits
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <><Zap className="h-3.5 w-3.5 mr-1.5" />Comprar +200 chamadas — R$20</>
              }
            </Button>
          </div>

          {/* History */}
          <div className="border-t border-border/40">
            <button
              onClick={historyOpen ? undefined : loadHistory}
              className="w-full flex items-center gap-2 px-5 py-3.5 hover:bg-surface-800/40 transition-colors text-left"
            >
              <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs font-semibold text-foreground flex-1">Histórico de uso</span>
              {loadingLogs ? (
                <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
              ) : historyOpen ? (
                <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>

            {historyOpen && !loadingLogs && (
              <>
                {logs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2 px-5">
                    <Sparkles className="h-7 w-7 text-muted-foreground opacity-20" />
                    <p className="text-xs text-muted-foreground">Nenhuma chamada registrada ainda</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/20">
                    {logs.map((log) => {
                      const isCredits = log.source === "credits";
                      const isMixed   = log.source === "mixed";
                      const dotColor  = isCredits ? "bg-purple-500" : isMixed ? "bg-purple-400" : "bg-red-500";
                      const crColor   = (isCredits || isMixed) ? "text-purple-400" : "text-red-400";
                      return (
                        <div key={log.id} className="flex items-center justify-between px-5 py-2.5 gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColor}`} />
                            <span className="text-xs text-foreground truncate">{log.label}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-[10px] font-medium ${crColor}`}>{log.credits} cr.</span>
                            <span className="text-[10px] text-muted-foreground">{formatRelativeLong(log.createdAt)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {hasMore && (
                  <div className="px-5 py-3">
                    <button
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="w-full flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      {loadingMore
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <ChevronDown className="h-3 w-3" />
                      }
                      Carregar mais
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
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
