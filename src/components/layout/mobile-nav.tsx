"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NAV } from "./sidebar";
import { Scissors, Menu, X, Bell, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface MobileNavProps {
  barbershopName?: string | null;
  userName?:       string | null;
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

interface Notification {
  id:    string;
  title: string;
  body:  string;
  createdAt: string;
}

// SVG ring constants
const R = 14;
const CIRC = 2 * Math.PI * R; // ≈ 87.96

export function MobileNav({ barbershopName, userName }: MobileNavProps) {
  const [open,      setOpen]      = useState(false);
  const [bellOpen,  setBellOpen]  = useState(false);
  const [notifs,    setNotifs]    = useState<Notification[]>([]);
  const [aiUsed,    setAiUsed]    = useState(0);
  const [aiTotal,   setAiTotal]   = useState(30);
  const [trialing,  setTrialing]  = useState(false);
  const pathname = usePathname();
  const router   = useRouter();
  const bellRef  = useRef<HTMLDivElement | null>(null);
  const supabase = getSupabaseBrowserClient();

  const loadNotifs = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifs(data.notifications ?? []);
    } catch {}
  }, []);

  const loadAi = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/usage");
      if (!res.ok) return;
      const data = await res.json();
      const isTrial = data.limit >= 999;
      setTrialing(isTrial);
      setAiUsed(isTrial ? 0 : data.used);
      setAiTotal(isTrial ? 1 : data.limit + data.credits);
    } catch {}
  }, []);

  useEffect(() => {
    loadNotifs();
    loadAi();
    const ni = setInterval(loadNotifs, 60_000);
    const ai = setInterval(loadAi, 30_000);
    window.addEventListener("ai-used", loadAi);
    return () => { clearInterval(ni); clearInterval(ai); window.removeEventListener("ai-used", loadAi); };
  }, [loadNotifs, loadAi]);

  // Close bell on outside click
  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    }
    document.addEventListener("mousedown", onOut);
    return () => document.removeEventListener("mousedown", onOut);
  }, []);

  async function dismiss(id: string) {
    setNotifs((prev) => prev.filter((n) => n.id !== id));
    await fetch("/api/notifications/dismiss", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    router.refresh();
  }

  const pct       = trialing ? 0 : Math.min(1, aiUsed / Math.max(1, aiTotal));
  const isLow     = !trialing && pct >= 0.8;
  const isOut     = !trialing && pct >= 1;
  const ringColor = isOut ? "#ef4444" : isLow ? "#f59e0b" : "#C9A84C";
  const offset    = CIRC * (1 - pct);
  const unread    = notifs.length;

  return (
    <div className="md:hidden sticky top-0 z-30">
      {/* Single top bar */}
      <div className="flex items-center justify-between bg-card/90 backdrop-blur border-b border-border px-4 py-2.5 gap-3">
        {/* Logo + name */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold-500/15 border border-gold-500/30">
            <Scissors className="h-3.5 w-3.5 text-gold-400" />
          </div>
          <div className="leading-tight min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{barbershopName ?? "GlaucoBarber"}</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Copiloto IA</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Bell */}
          <div className="relative" ref={bellRef}>
            <button
              onClick={() => { setBellOpen((v) => !v); setOpen(false); }}
              className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            >
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span className="absolute top-1 right-1 h-3.5 w-3.5 rounded-full bg-gold-400 text-[8px] font-bold text-black flex items-center justify-center">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>

            {bellOpen && (
              <div className="absolute right-0 top-full mt-1 w-72 rounded-xl border border-border bg-card shadow-xl overflow-hidden z-50">
                <div className="px-4 py-2.5 border-b border-border/60">
                  <p className="text-xs font-semibold text-foreground">Notificações</p>
                </div>
                {notifs.length === 0 ? (
                  <div className="flex flex-col items-center py-6 gap-1 text-muted-foreground">
                    <Bell className="h-5 w-5 opacity-20" />
                    <p className="text-xs">Sem notificações</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/30 max-h-64 overflow-y-auto">
                    {notifs.map((n) => (
                      <div key={n.id} className="flex items-start gap-2 px-4 py-3">
                        <Sparkles className="h-3 w-3 text-gold-400 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground">{n.title}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{n.body}</p>
                        </div>
                        <button onClick={() => dismiss(n.id)} className="shrink-0 text-muted-foreground p-0.5">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {notifs.length > 0 && (
                  <div className="px-4 py-2 border-t border-border/60">
                    <Link href="/billing" onClick={() => setBellOpen(false)} className="text-[11px] text-muted-foreground">Ver plano →</Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Avatar with AI ring */}
          {userName && (
            <div className="relative flex h-8 w-8 items-center justify-center">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 32 32" aria-hidden="true">
                <circle cx="16" cy="16" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="2" />
                {trialing ? (
                  <circle cx="16" cy="16" r={R} fill="none" stroke="#C9A84C" strokeWidth="2"
                    strokeDasharray={`${CIRC * 0.75} ${CIRC * 0.25}`} />
                ) : (
                  <circle cx="16" cy="16" r={R} fill="none" stroke={ringColor} strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray={CIRC}
                    strokeDashoffset={offset}
                    style={{ transition: "stroke-dashoffset 0.5s ease, stroke 0.3s ease" }}
                  />
                )}
              </svg>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold-500/20 border border-gold-500/30 text-[10px] font-bold text-gold-400 select-none">
                {getInitials(userName)}
              </span>
            </div>
          )}

          {/* Hamburger */}
          <button
            onClick={() => { setOpen((v) => !v); setBellOpen(false); }}
            aria-label="Abrir menu"
            className="rounded-md border border-border bg-surface-900 p-1.5 text-foreground"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Nav drawer */}
      {open && (
        <div className="bg-card border-b border-border shadow-xl">
          <nav className="grid grid-cols-2 gap-px bg-border">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-gold-500/15 text-gold-400"
                      : "bg-card text-muted-foreground hover:bg-surface-800 hover:text-foreground"
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", active ? "text-gold-400" : "")} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>
          {/* Quick settings / logout */}
          <div className="flex gap-2 px-4 py-3 border-t border-border/60">
            <Link href="/settings" onClick={() => setOpen(false)}
              className="flex-1 text-center text-xs text-muted-foreground py-1.5 rounded-md hover:bg-surface-800">
              Configurações
            </Link>
            <button
              onClick={async () => { await supabase.auth.signOut(); router.push("/login"); }}
              className="flex-1 text-center text-xs text-muted-foreground py-1.5 rounded-md hover:bg-surface-800"
            >
              Sair
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
