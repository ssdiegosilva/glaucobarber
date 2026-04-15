"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NAV, SEGMENT_ICON_MAP } from "./sidebar";
import { Scissors, Menu, X, Bell, Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { InstallAppBanner } from "@/components/pwa/install-banner";
import { AiProfilePanel } from "./ai-profile-panel";

interface MobileNavProps {
  barbershopName?: string | null;
  userName?:       string | null;
  /** Module keys to show in nav; undefined = show all */
  availableModules?: string[];
  /** Lucide icon name for the segment (e.g. "Scissors", "Sparkles") */
  segmentIcon?: string;
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

interface Notification {
  id:        string;
  title:     string;
  body:      string;
  link?:     string | null;
  createdAt: string;
}

// SVG ring constants
const R = 14;
const CIRC = 2 * Math.PI * R; // ≈ 87.96

export function MobileNav({ barbershopName, userName, availableModules, segmentIcon }: MobileNavProps) {
  const BrandIcon: LucideIcon = segmentIcon ? (SEGMENT_ICON_MAP[segmentIcon] ?? Scissors) : Scissors;
  const [open,       setOpen]       = useState(false);
  const [bellOpen,   setBellOpen]   = useState(false);
  const [panelOpen,  setPanelOpen]  = useState(false);
  const [notifs,     setNotifs]     = useState<Notification[]>([]);
  const [aiUsed,     setAiUsed]     = useState(0);
  const [aiTotal,    setAiTotal]    = useState(30);
  const [trialing,   setTrialing]   = useState(false);
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
      setTrialing(data.isTrialing ?? false);
      setAiUsed(data.used);
      setAiTotal(data.limit);
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

  const pct       = Math.min(1, aiUsed / Math.max(1, aiTotal));
  const isLow     = pct >= 0.8;
  const isOut     = pct >= 1;
  const ringColor = isOut ? "#ef4444" : isLow ? "#f59e0b" : "#C9A84C";
  const offset    = CIRC * (1 - pct);
  const unread    = notifs.length;

  return (
    <div className="md:hidden sticky top-0 z-30">
      {/* Single top bar */}
      <div className="flex items-center justify-between bg-card/90 backdrop-blur border-b border-border px-4 py-2.5 gap-3">
        {/* Logo + name */}
        <Link href="/dashboard" className="flex items-center gap-2 min-w-0" onClick={() => setOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-dark.png" alt="Voltaki" className="h-9 w-auto shrink-0" />
          {barbershopName && (
            <p className="text-sm font-semibold text-foreground truncate">{barbershopName}</p>
          )}
        </Link>

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
                        <button onClick={() => dismiss(n.id)} className="shrink-0 text-muted-foreground p-1">
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

          {/* Avatar with AI ring — clickable */}
          {userName && (
            <>
              <button
                onClick={() => { setPanelOpen(true); setOpen(false); setBellOpen(false); }}
                title={trialing ? "Trial — IA disponível" : `IA: ${aiUsed}/${aiTotal}`}
                className="relative flex h-8 w-8 items-center justify-center"
              >
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 32 32" aria-hidden="true">
                  <circle cx="16" cy="16" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="2" />
                  <circle cx="16" cy="16" r={R} fill="none" stroke={ringColor} strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray={CIRC}
                    strokeDashoffset={offset}
                    style={{ transition: "stroke-dashoffset 0.5s ease, stroke 0.3s ease" }}
                  />
                </svg>
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold-500/20 border border-gold-500/30 text-[10px] font-bold text-gold-400 select-none">
                  {getInitials(userName)}
                </span>
              </button>

              <AiProfilePanel
                userName={userName}
                open={panelOpen}
                onOpenChange={setPanelOpen}
              />
            </>
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
            {NAV.filter(({ key }) => {
              if (!availableModules || availableModules.length === 0) return true;
              return availableModules.includes(key);
            }).map(({ href, label, icon: Icon, key }) => {
              const active = pathname === href || pathname.startsWith(href.split("?")[0] + "/");
              const NavIcon = key === "services" ? BrandIcon : Icon;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/15 text-primary"
                      : "bg-card text-muted-foreground hover:bg-surface-800 hover:text-foreground"
                  )}
                >
                  <NavIcon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "")} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>
          {/* Install App */}
          <div className="px-4 pt-3">
            <InstallAppBanner />
          </div>

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
