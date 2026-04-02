"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Scissors,
  Tag,
  Megaphone,
  Plug,
  Settings,
  Sparkles,
  LogOut,
  ChevronRight,
  TrendingUp,
  MessageCircle,
  HeartHandshake,
  CreditCard,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export const NAV = [
  { href: "/dashboard",    label: "Dashboard",   icon: LayoutDashboard },
  { href: "/agenda",       label: "Agenda",      icon: CalendarDays },
  { href: "/copilot",      label: "Copilot",     icon: Sparkles },
  { href: "/financeiro",   label: "Financeiro",  icon: TrendingUp },
  { href: "/clients",      label: "Clientes",    icon: Users },
  { href: "/services",     label: "Serviços",    icon: Scissors },
  { href: "/offers",       label: "Ofertas",     icon: Tag },
  { href: "/campaigns",    label: "Campanhas",   icon: Megaphone },
  { href: "/whatsapp",     label: "WhatsApp",    icon: MessageCircle },
  { href: "/post-sale",    label: "Pós-venda",   icon: HeartHandshake },
  { href: "/integrations", label: "Integrações", icon: Plug },
  { href: "/settings",     label: "Configurações",icon: Settings },
  { href: "/billing",      label: "Plano",        icon: CreditCard },
];

interface SidebarProps {
  barbershopName?: string | null;
  className?: string;
  aiUsed?:    number;
  aiLimit?:   number;
  aiCredits?: number;
}

export function Sidebar({ barbershopName, className, aiUsed = 0, aiLimit = 30, aiCredits = 0 }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  return (
    <aside className={cn("flex h-screen w-60 flex-col border-r border-border bg-card", className)}>
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-500/15 border border-gold-500/30">
          <Scissors className="h-4 w-4 text-gold-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground leading-tight truncate">
            {barbershopName ?? "GlaucoBarber"}
          </p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
            Copiloto IA
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <ul className="space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all",
                    active
                      ? "bg-gold-500/15 text-gold-400 border border-gold-500/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface-700"
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", active ? "text-gold-400" : "")} />
                  <span className="flex-1">{label}</span>
                  {active && <ChevronRight className="h-3 w-3 text-gold-400/50" />}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* AI Usage Indicator */}
        {(() => {
          const total    = aiLimit + aiCredits;
          const pct      = total > 0 ? Math.min(100, Math.round((aiUsed / total) * 100)) : 100;
          const remaining = Math.max(0, total - aiUsed);
          const isLow    = pct >= 80;
          const isOut    = pct >= 100;
          return (
            <Link href="/billing" className="mt-6 mx-1 rounded-lg bg-gold-500/8 border border-gold-500/15 p-3 block hover:bg-gold-500/12 transition-colors">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Sparkles className={`h-3.5 w-3.5 ${isOut ? "text-red-400" : isLow ? "text-amber-400" : "text-gold-400"}`} />
                  <span className={`text-xs font-semibold ${isOut ? "text-red-400" : isLow ? "text-amber-400" : "text-gold-400"}`}>
                    {isOut ? "IA Esgotada" : "IA"}
                  </span>
                </div>
                <span className={`text-[10px] ${isOut ? "text-red-400" : "text-muted-foreground"}`}>
                  {aiUsed}/{total}
                </span>
              </div>
              <div className="h-1 rounded-full bg-surface-700 overflow-hidden mb-1.5">
                <div
                  className={`h-full rounded-full ${isOut ? "bg-red-500" : isLow ? "bg-amber-500" : "bg-gold-500"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                {isOut
                  ? "Adicionar créditos →"
                  : `${remaining} chamada${remaining !== 1 ? "s" : ""} restante${remaining !== 1 ? "s" : ""}`}
              </p>
            </Link>
          );
        })()}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3">
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            router.push("/login");
          }}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-700 transition-all"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
