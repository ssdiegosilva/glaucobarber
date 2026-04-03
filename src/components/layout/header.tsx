"use client";

import { Bell, LogOut, PencilLine, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
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

export function Header({ title, subtitle, userName, actions }: HeaderProps) {
  const [menuOpen,   setMenuOpen]   = useState(false);
  const [bellOpen,   setBellOpen]   = useState(false);
  const [notifs,     setNotifs]     = useState<Notification[]>([]);
  const [aiUsed,     setAiUsed]     = useState(0);
  const [aiTotal,    setAiTotal]    = useState(30);
  const [aiTrialing, setAiTrialing] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
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
    return () => clearInterval(interval);
  }, [loadNotifs]);

  const loadAiUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/usage");
      if (!res.ok) return;
      const data = await res.json();
      // limit === 999 means trialing (unlimited)
      const isTrialing = data.limit >= 999;
      setAiTrialing(isTrialing);
      setAiUsed(isTrialing ? 0 : data.used);
      setAiTotal(isTrialing ? 1 : data.limit + data.credits);
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
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
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

  const unread = notifs.length;

  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-4 bg-card/50 backdrop-blur-sm md:sticky md:top-0 z-10">
      <div>
        <h1 className="text-lg font-bold text-foreground">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
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
                    <div key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-surface-800/40 transition-colors">
                      <Sparkles className="h-3.5 w-3.5 text-gold-400 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <p className="text-xs font-medium text-foreground truncate">{n.title}</p>
                          <span className="text-[10px] text-muted-foreground shrink-0">{formatRelative(n.createdAt)}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{n.body}</p>
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

        {/* Avatar with AI usage ring */}
        {userName && (
          <div className="relative" ref={menuRef}>
            {(() => {
              const pct      = aiTrialing ? 0 : Math.min(1, aiUsed / Math.max(1, aiTotal));
              const isLow    = !aiTrialing && pct >= 0.8;
              const isOut    = !aiTrialing && pct >= 1;
              const ringColor = isOut ? "#ef4444" : isLow ? "#f59e0b" : "#C9A84C";
              const trackColor = "rgba(255,255,255,0.07)";
              const offset   = RING_CIRCUMFERENCE * (1 - pct);

              return (
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  title={aiTrialing ? "Trial — IA disponível" : `IA: ${aiUsed}/${aiTotal} chamadas`}
                  className="relative flex h-10 w-10 items-center justify-center"
                >
                  {/* SVG ring */}
                  <svg
                    className="absolute inset-0 -rotate-90"
                    viewBox="0 0 40 40"
                    aria-hidden="true"
                  >
                    {/* Track */}
                    <circle
                      cx="20" cy="20" r={RING_R}
                      fill="none"
                      stroke={trackColor}
                      strokeWidth="2.5"
                    />
                    {/* Progress */}
                    {!aiTrialing && (
                      <circle
                        cx="20" cy="20" r={RING_R}
                        fill="none"
                        stroke={ringColor}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeDasharray={RING_CIRCUMFERENCE}
                        strokeDashoffset={offset}
                        style={{ transition: "stroke-dashoffset 0.5s ease, stroke 0.3s ease" }}
                      />
                    )}
                    {/* Trialing: full gold ring */}
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

                  {/* Avatar */}
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold-500/20 border border-gold-500/30 text-[11px] font-bold text-gold-400 select-none">
                    {getInitials(userName)}
                  </span>
                </button>
              );
            })()}

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-52 rounded-lg border border-border bg-card shadow-lg p-1 text-sm">
                {/* Usage summary */}
                <div className="px-3 py-2 mb-1 border-b border-border/60">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Uso de IA</p>
                  {aiTrialing ? (
                    <p className="text-xs text-gold-400 font-medium">Trial — ilimitado</p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-foreground font-medium">{aiUsed}/{aiTotal} chamadas</span>
                        <span className="text-[10px] text-muted-foreground">{Math.round((aiUsed / Math.max(1, aiTotal)) * 100)}%</span>
                      </div>
                      <div className="h-1 rounded-full bg-surface-700 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, Math.round((aiUsed / Math.max(1, aiTotal)) * 100))}%`,
                            backgroundColor: aiUsed >= aiTotal ? "#ef4444" : aiUsed / aiTotal >= 0.8 ? "#f59e0b" : "#C9A84C",
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>

                <Link
                  href="/settings"
                  className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-surface-800 text-foreground"
                  onClick={() => setMenuOpen(false)}
                >
                  <PencilLine className="h-4 w-4" />
                  Editar perfil
                </Link>
                <Link
                  href="/billing"
                  className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-surface-800 text-foreground"
                  onClick={() => setMenuOpen(false)}
                >
                  <Sparkles className="h-4 w-4" />
                  Ver plano
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-surface-800 text-left text-foreground"
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
