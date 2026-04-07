"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Store,
  Users,
  Brain,
  Receipt,
  ScrollText,
  ToggleLeft,
  SlidersHorizontal,
  DollarSign,
  Activity,
} from "lucide-react";

const NAV = [
  { href: "/admin/overview",      label: "Overview",        icon: LayoutDashboard },
  { href: "/admin/barbershops",   label: "Barbearias",      icon: Store },
  { href: "/admin/users",         label: "Usuários",        icon: Users },
  { href: "/admin/features",      label: "Funcionalidades", icon: ToggleLeft },
  { href: "/admin/observability", label: "Observabilidade", icon: Activity },
  { href: "/admin/ai-config",     label: "Config IA",       icon: SlidersHorizontal },
  { href: "/admin/ai-usage",      label: "Uso de IA",       icon: Brain },
  { href: "/admin/openai-costs",  label: "Custos OpenAI",   icon: DollarSign },
  { href: "/admin/billing",       label: "Cobrança",        icon: Receipt },
  { href: "/admin/logs",          label: "Audit Logs",      icon: ScrollText },
];

export function AdminMobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="md:hidden sticky top-0 z-30">
      {/* Top bar */}
      <div className="flex items-center justify-between bg-card/90 backdrop-blur border-b border-border px-4 py-2.5">
        <Link href="/admin/overview" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <span className="flex items-center justify-center w-7 h-7 rounded-md bg-red-500/20 border border-red-500/30">
            <ShieldCheck className="h-4 w-4 text-red-400" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-foreground">Admin</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-widest">GlaucoBarber</p>
          </div>
        </Link>

        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Abrir menu"
          className="rounded-md border border-border bg-surface-900 p-1.5 text-foreground"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav drawer */}
      {open && (
        <div className="bg-card border-b border-border shadow-xl">
          <nav className="grid grid-cols-2 gap-px bg-border">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-red-500/15 text-red-400"
                      : "bg-card text-muted-foreground hover:bg-surface-800 hover:text-foreground"
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", active ? "text-red-400" : "")} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="px-4 py-3 border-t border-border/60">
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Voltar ao app
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
