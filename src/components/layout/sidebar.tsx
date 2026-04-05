"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  UsersRound,
  Scissors,
  Megaphone,
  Settings,
  Sparkles,
  LogOut,
  ChevronRight,
  TrendingUp,
  Target,
  MessageCircle,
  HeartHandshake,
  CreditCard,
  Wand2,
} from "lucide-react";
import { AiUsageWidget } from "./ai-usage-widget";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { InstallAppBanner } from "@/components/pwa/install-banner";

export const NAV = [
  { href: "/dashboard",    label: "Dashboard",   icon: LayoutDashboard },
  { href: "/agenda",       label: "Agenda",      icon: CalendarDays },
  { href: "/copilot",      label: "Copilot",     icon: Sparkles },
  { href: "/financeiro",   label: "Financeiro",  icon: TrendingUp },
  { href: "/meta",         label: "Metas",       icon: Target },
  { href: "/clients",      label: "Clientes",    icon: Users },
  { href: "/services",     label: "Serviços",    icon: Scissors },
  { href: "/campaigns",    label: "Campanhas",   icon: Megaphone },
  { href: "/criar-visual", label: "Criar Visual", icon: Wand2 },
  { href: "/whatsapp",     label: "WhatsApp",    icon: MessageCircle },
  { href: "/post-sale",    label: "Pós-venda",   icon: HeartHandshake },
  { href: "/settings?section=team", label: "Equipe", icon: UsersRound },
  { href: "/settings",     label: "Configurações",icon: Settings },
  { href: "/billing",      label: "Plano",        icon: CreditCard },
];

interface SidebarProps {
  barbershopName?: string | null;
  className?: string;
  aiUsed?:      number;
  aiLimit?:     number;
  aiCredits?:   number;
  aiTrialing?:  boolean;
}

export function Sidebar({ barbershopName, className, aiUsed = 0, aiLimit = 30, aiCredits = 0, aiTrialing = false }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  return (
    <aside className={cn("flex h-screen w-60 flex-col border-r border-border bg-card", className)}>
      {/* Logo / Brand */}
      <Link href="/dashboard" className="flex items-center gap-3 px-5 py-5 border-b border-border hover:bg-surface-800/40 transition-colors">
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
      </Link>

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
        <AiUsageWidget
          initialUsed={aiUsed}
          initialLimit={aiLimit}
          initialCredits={aiCredits}
          initialTrialing={aiTrialing}
        />
      </nav>

      {/* Install App */}
      <InstallAppBanner />

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
