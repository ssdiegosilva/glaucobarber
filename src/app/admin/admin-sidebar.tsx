"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Store,
  Users,
  Brain,
  Receipt,
  ScrollText,
  ShieldCheck,
  ToggleLeft,
  SlidersHorizontal,
  DollarSign,
} from "lucide-react";

const NAV = [
  { href: "/admin/overview",       label: "Overview",        icon: LayoutDashboard    },
  { href: "/admin/barbershops",    label: "Barbearias",      icon: Store              },
  { href: "/admin/users",          label: "Usuários",        icon: Users              },
  { href: "/admin/features",       label: "Funcionalidades", icon: ToggleLeft         },
  { href: "/admin/ai-config",      label: "Config IA",       icon: SlidersHorizontal  },
  { href: "/admin/ai-usage",       label: "Uso de IA",       icon: Brain              },
  { href: "/admin/openai-costs",   label: "Custos OpenAI",   icon: DollarSign         },
  { href: "/admin/billing",        label: "Cobrança",        icon: Receipt            },
  { href: "/admin/logs",           label: "Audit Logs",      icon: ScrollText         },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-60 border-r border-border bg-surface-900 shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
        <span className="flex items-center justify-center w-7 h-7 rounded-md bg-red-500/20 border border-red-500/30">
          <ShieldCheck className="h-4 w-4 text-red-400" />
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground leading-none">Admin</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">GlaucoBarber Platform</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-red-500/10 text-red-400 border border-red-500/20"
                  : "text-muted-foreground hover:bg-surface-800 hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-border">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Voltar ao app
        </Link>
      </div>
    </aside>
  );
}
