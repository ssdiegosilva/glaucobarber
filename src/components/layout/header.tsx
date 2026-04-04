"use client";

import { Bell, LogOut, PencilLine, X, Sparkles, Zap, Loader2, Clock, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getInitials } from "@/lib/utils";
import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

// SVG ring constants — 40×40 viewBox, r=17
const RING_R = 17;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R; // ≈ 106.8

interface HeaderProps {
  title:     string;
  subtitle?: string;
  userName?: string | null;
  actions?:  React.ReactNode;
}

interface Notification {
  id:        string;
  type:      string;
  title:     string;
  body:      string;
  link?:     string | null;
  createdAt: string;
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
  if (mins < 60)  return `${mins}min`;
  if (hours < 24) return `${hours}h`;
  return `${days}d`;
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

export function Header({ title, subtitle, userName, actions }: HeaderProps) {
  const [panelOpen,    setPanelOpen]    = useState(false);
  const [bellOpen,     setBellOpen]     = useState(false);
  const [notifs,       setNotifs]       = useState<Notification[]>([]);
  const [aiUsed,       setAiUsed]       = useState(0);
  const [aiTotal,      setAiTotal]      = useState(30);
  const [aiTrialing,   setAiTrialing]   = useState(false);
  const [aiCredits,    setAiCredits]    = useState(0);
  const [logs,         setLogs]         = useState<CallLog[]>([]);
  const [loadingLogs,  setLoadingLogs]  = useState(false);
  const [buyingCredits,setBuyingCredits]= useState(false);
  const bellRef = useRef<HTMLDivElement | null>(null);
  const supabase = getSupabaseBrowserClient();
  const router   = useRouter();

  const loadNotifs = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifs(data.notifications ?? []);
    } catch {}
  }, []);

  useEffect(() => {
    loadNotifs();
    const interval = setInterval(loadNotifs, 60_000);
    window.addEventListener("notifications-changed", loadNotifs);
    return () => { clearInterval(interval); window.removeEventListener("notifications-changed", loadNotifs); };
  }, [loadNotifs]);

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

  useEffect(() => {
    loadAiUsage();
    const interval = setInterval(loadAiUsage, 30_000);
    window.addEventListener("ai-used", loadAiUsage);
    return () => { clearInterval(interval); window.removeEventListener("ai-used", loadAiUsage); };
  }, [loadAiUsage]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function dismiss(id: string) {
    setNotifs((prev) => prev.filter((n) => n.id !== id));
    await fetch("/api/notifications/dismiss", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id }),
    });
    router.refresh();
  }

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

  async function buyCredits() {
    setBuyingCredits(true);
    try {
      const res = await fetch("/api/billing/credits/checkout", { method: "POST" });
      if (res.redirected) window.location.href = res.url;
    } finally {
      setBuyingCredits(false);
    }
  }

  function openPanel() {
    setPanelOpen(true);
    loadHistory();
    loadAiUsage();
  }

  const unread = notifs.length;

  // Derived AI state
  const pct       = aiTrialing ? 0 : Math.min(100, Math.round((aiUsed / Math.max(1, aiTotal)) * 100));
  const remaining = Math.max(0, aiTotal - aiUsed);
  const isLow     = !aiTrialing && pct >= 80;
  const isOut     = !aiTrialing && pct >= 100;
  const ringColor  = isOut ? "#ef4444" : isLow ? "#f59e0b" : "#C9A84C";
  const barColor   = isOut ? "bg-red-500" : isLow ? "bg-amber-500" : "bg-gold-500";
  const textColor  = isOut ? "text-red-400" : isLow ? "text-amber-400" : "text-gold-400";
  const ringOffset = RING_CIRCUMFERENCE * (1 - Math.min(1, aiUsed / Math.max(1, aiTotal)));

  return (
    <header className="flex items-center justify-between border-b border-border px-4 py-2.5 sm:px-6 sm:py-4 bg-card/50 backdrop-blur-sm md:sticky md:top-0 z-10">
      <div>
        <h1 className="text-sm font-semibold text-foreground sm:text-lg sm:font-bold">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">{subtitle}</p>}
      </div>

      <div className="hidden md:flex items-center gap-3">
        {actions}

        {/* Bell */}
        <div className="relative" ref={bellRef}>
          <Button
            variant="ghost"
            size="icon-sm"
            className="relative text-muted-foreground"
            onClick={() => setBellOpen((v) => !v)}
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-gold-400 text-[9px] font-bold text-black flex items-center justify-center leading-none">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Button>

          {bellOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl border border-border bg-card shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
                <span className="text-sm font-semibold text-foreground">Notificações</span>
                {unread === 0 && (
                  <span className="text-xs text-muted-foreground">Nenhuma pendente</span>
                )}
              </div>

              {notifs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                  <Bell className="h-6 w-6 opacity-20" />
                  <p className="text-xs">Sem notificações</p>
                </div>
              ) : (
                <div className="divide-y divide-border/30 max-h-80 overflow-y-auto">
                  {notifs.map((n) => (
                    <div key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-surface-800/40 transition-colors group">
                      <Sparkles className="h-3.5 w-3.5 text-gold-400 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          {n.link ? (
                            <Link
                              href={n.link}
                              onClick={() => { setBellOpen(false); dismiss(n.id); }}
                              className="text-xs font-medium text-foreground truncate hover:text-gold-400 transition-colors"
                            >
                              {n.title}
                            </Link>
                          ) : (
                            <p className="text-xs font-medium text-foreground truncate">{n.title}</p>
                          )}
                          <span className="text-[10px] text-muted-foreground shrink-0">{formatRelative(n.createdAt)}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{n.body}</p>
                        {n.link && (
                          <Link
                            href={n.link}
                            onClick={() => { setBellOpen(false); dismiss(n.id); }}
                            className="mt-1 inline-flex items-center gap-1 text-[10px] text-gold-400/70 hover:text-gold-400 transition-colors"
                          >
                            Ver campanha →
                          </Link>
                        )}
                      </div>
                      <button
                        onClick={() => dismiss(n.id)}
                        className="shrink-0 p-0.5 rounded hover:bg-surface-700 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Dispensar"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {notifs.length > 0 && (
                <div className="px-4 py-2 border-t border-border/60">
                  <Link
                    href="/billing"
                    onClick={() => setBellOpen(false)}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Ver plano →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Avatar with AI usage ring → opens full AI panel */}
        {userName && (
          <>
            <button
              onClick={openPanel}
              title={aiTrialing ? "Trial — IA disponível" : `IA: ${aiUsed}/${aiTotal} chamadas`}
              className="relative flex h-10 w-10 items-center justify-center"
            >
              {/* SVG ring */}
              <svg
                className="absolute inset-0 -rotate-90"
                viewBox="0 0 40 40"
                aria-hidden="true"
              >
                <circle
                  cx="20" cy="20" r={RING_R}
                  fill="none"
                  stroke="rgba(255,255,255,0.07)"
                  strokeWidth="2.5"
                />
                {!aiTrialing && (
                  <circle
                    cx="20" cy="20" r={RING_R}
                    fill="none"
                    stroke={ringColor}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray={RING_CIRCUMFERENCE}
                    strokeDashoffset={ringOffset}
                    style={{ transition: "stroke-dashoffset 0.5s ease, stroke 0.3s ease" }}
                  />
                )}
                {aiTrialing && (
                  <circle
                    cx="20" cy="20" r={RING_R}
                    fill="none"
                    stroke="#C9A84C"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray={`${RING_CIRCUMFERENCE * 0.75} ${RING_CIRCUMFERENCE * 0.25}`}
                    style={{ transition: "stroke-dashoffset 0.5s ease" }}
                  />
                )}
              </svg>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold-500/20 border border-gold-500/30 text-[11px] font-bold text-gold-400 select-none">
                {getInitials(userName)}
              </span>
            </button>

            {/* AI Usage & Profile Panel */}
            <Sheet open={panelOpen} onOpenChange={(v) => { setPanelOpen(v); if (!v) router.refresh(); }}>
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
                          <span className="text-xs font-semibold text-foreground">Chamadas de IA</span>
                          <span className={`text-xs font-bold ${textColor}`}>
                            {aiUsed} / {aiTotal}
                          </span>
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
                              : `${remaining} chamada${remaining !== 1 ? "s" : ""} restante${remaining !== 1 ? "s" : ""}`}
                          </span>
                          <span className={textColor}>{pct}%</span>
                        </div>

                        {aiCredits > 0 && (
                          <p className="text-[11px] text-purple-400">
                            + {aiCredits} crédito{aiCredits !== 1 ? "s" : ""} extra{aiCredits !== 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Buy credits button */}
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
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-sm gap-2 px-5">
                      <Sparkles className="h-7 w-7 opacity-20" />
                      <p className="text-xs">Nenhuma chamada registrada ainda</p>
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

                {/* Footer actions */}
                <div className="border-t border-border/60 px-5 py-3 shrink-0 space-y-0.5">
                  <Link
                    href="/settings"
                    onClick={() => setPanelOpen(false)}
                    className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-surface-800 text-sm text-foreground transition-colors"
                  >
                    <PencilLine className="h-4 w-4 text-muted-foreground" />
                    Editar perfil
                  </Link>
                  <Link
                    href="/billing"
                    onClick={() => setPanelOpen(false)}
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
          </>
        )}
      </div>
    </header>
  );
}
