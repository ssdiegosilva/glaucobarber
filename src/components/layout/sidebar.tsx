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
];

interface SidebarProps {
  barbershopName?: string | null;
  className?: string;
}

export function Sidebar({ barbershopName, className }: SidebarProps) {
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

        {/* AI Badge */}
        <div className="mt-6 mx-1 rounded-lg bg-gold-500/8 border border-gold-500/15 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-3.5 w-3.5 text-gold-400" />
            <span className="text-xs font-semibold text-gold-400">IA Ativa</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Sugestões geradas automaticamente toda manhã
          </p>
        </div>
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
