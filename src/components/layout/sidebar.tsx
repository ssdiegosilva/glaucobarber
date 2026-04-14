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
  ChevronsUpDown,
  Plus,
  Check,
  GalleryHorizontal,
  LifeBuoy,
  Store,
  Star,
  ShoppingBag,
  Package,
  BadgePercent,
  Croissant,
  Sandwich,
  CakeSlice,
  Coffee,
  Dog,
  BicepsFlexed,
  Utensils,
  Wheat,
  Pizza,
  Wine,
  PawPrint,
  Dumbbell,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { AiUsageWidget } from "./ai-usage-widget";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { InstallAppBanner } from "@/components/pwa/install-banner";

// Map of Lucide icon names usable as segment icons
export const SEGMENT_ICON_MAP: Record<string, LucideIcon> = {
  // Beleza & serviços agendados
  Scissors,
  Sparkles,
  Star,
  Target,
  Store,
  ShoppingBag,
  // Geral
  Package,     // produtos
  // Alimentação
  Wheat,       // padaria
  Croissant,   // padaria alternativo
  Sandwich,    // lanchonete
  CakeSlice,   // confeitaria / boleria
  Pizza,       // pizzaria
  Utensils,    // restaurante
  UtensilsCrossed,
  Coffee,      // cafeteria
  Wine,        // adega
  // Pet & fitness
  Dog,         // pet shop
  PawPrint,
  BicepsFlexed, // academia
  Dumbbell,
};

export const NAV = [
  { href: "/dashboard",    label: "Dashboard",    icon: LayoutDashboard, key: "dashboard" },
  { href: "/agenda",       label: "Agenda",       icon: CalendarDays,    key: "agenda" },
  { href: "/visitas",      label: "Visitas",      icon: ShoppingBag,     key: "visitas" },
  { href: "/produtos",     label: "Produtos",     icon: Package,         key: "produtos" },
  { href: "/copilot",      label: "Copilot",      icon: Sparkles,        key: "copilot" },
  { href: "/financeiro",   label: "Financeiro",   icon: TrendingUp,      key: "financeiro" },
  { href: "/meta",         label: "Metas",        icon: Target,          key: "meta" },
  { href: "/clients",      label: "Clientes",     icon: Users,           key: "clients" },
  { href: "/services",     label: "Serviços",     icon: Scissors,        key: "services" },
  { href: "/ofertas",      label: "Ofertas",      icon: BadgePercent,    key: "targeted-offers" },
  { href: "/campaigns",    label: "Campanhas",    icon: Megaphone,       key: "campaigns" },
  { href: "/vitrine",      label: "Vitrine",      icon: GalleryHorizontal, key: "vitrine" },
  { href: "/criar-visual", label: "Criar Visual", icon: Wand2,           key: "criar-visual" },
  { href: "/whatsapp",     label: "WhatsApp",     icon: MessageCircle,   key: "whatsapp" },
  { href: "/post-sale",    label: "Pós-venda",    icon: HeartHandshake,  key: "post-sale" },
  { href: "/settings",     label: "Configurações", icon: Settings,       key: "settings" },
  { href: "/billing",      label: "Plano",         icon: CreditCard,     key: "billing" },
  { href: "/support",      label: "Suporte",       icon: LifeBuoy,       key: "support" },
];

interface MembershipInfo {
  barbershopId:   string;
  barbershopName: string;
  role:           string;
}

interface SidebarProps {
  barbershopName?: string | null;
  activeBarbershopId?: string | null;
  memberships?: MembershipInfo[];
  className?: string;
  aiUsed?:      number;
  aiLimit?:     number;
  aiCredits?:   number;
  aiTrialing?:  boolean;
  /** Lucide icon name for the segment (e.g. "Scissors", "Sparkles") */
  segmentIcon?: string;
  /** Module keys to show in nav; undefined = show all */
  availableModules?: string[];
}

export function Sidebar({
  barbershopName,
  activeBarbershopId,
  memberships = [],
  className,
  aiUsed = 0,
  aiLimit = 30,
  aiCredits = 0,
  aiTrialing = false,
  segmentIcon,
  availableModules,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const hasMultiple = memberships.length > 1;

  // Dynamic segment icon (falls back to Scissors)
  const BrandIcon: LucideIcon =
    segmentIcon ? (SEGMENT_ICON_MAP[segmentIcon] ?? Scissors) : Scissors;

  // Filter nav by availableModules; if undefined = show all
  const visibleNav =
    availableModules && availableModules.length > 0
      ? NAV.filter(({ key, href }) => {
          // Always show settings, billing, support
          if (["settings", "billing", "support"].includes(key)) return true;
          return availableModules.some(
            (m) => key === m || href === `/${m}` || href.startsWith(`/${m}/`)
          );
        })
      : NAV;

  async function switchBarbershop(barbershopId: string) {
    if (barbershopId === activeBarbershopId) {
      setSwitcherOpen(false);
      return;
    }
    setSwitching(true);
    await fetch("/api/barbershop/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barbershopId }),
    });
    setSwitcherOpen(false);
    setSwitching(false);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <aside className={cn("flex h-screen w-60 flex-col border-r border-border bg-card", className)}>
      {/* Logo / Brand + Switcher */}
      <div className="relative border-b border-border">
        <button
          onClick={() => hasMultiple ? setSwitcherOpen((v) => !v) : router.push("/dashboard")}
          className="flex w-full items-center gap-3 px-5 py-5 hover:bg-surface-800/40 transition-colors text-left"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 border border-primary/30 shrink-0">
            <BrandIcon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground leading-tight truncate">
              {barbershopName ?? "Voltaki"}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
              Copiloto IA
            </p>
          </div>
          {hasMultiple && (
            <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </button>

        {/* Switcher dropdown */}
        {switcherOpen && (
          <div className="absolute left-3 right-3 top-full mt-1 z-50 rounded-lg border border-border bg-card shadow-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-border/60">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Trocar estabelecimento</p>
            </div>
            <div className="py-1 max-h-48 overflow-y-auto">
              {memberships.map((m) => (
                <button
                  key={m.barbershopId}
                  onClick={() => switchBarbershop(m.barbershopId)}
                  disabled={switching}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-700 transition-colors"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 border border-primary/20 shrink-0">
                    <BrandIcon className="h-3 w-3 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{m.barbershopName}</p>
                    <p className="text-[10px] text-muted-foreground">{m.role === "OWNER" ? "Dono" : m.role === "BARBER" ? "Barbeiro" : "Equipe"}</p>
                  </div>
                  {m.barbershopId === activeBarbershopId && (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  )}
                </button>
              ))}
            </div>
            <div className="border-t border-border/60 py-1">
              <Link
                href="/onboarding?new=true"
                onClick={() => setSwitcherOpen(false)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-700 transition-colors"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted/60 border border-border shrink-0">
                  <Plus className="h-3 w-3 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">Criar novo estabelecimento</p>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <ul className="space-y-0.5">
          {visibleNav.map(({ href, label, icon: Icon, key }) => {
            const active = pathname === href || (href !== "/" && pathname.startsWith(href.split("?")[0]));
            const NavIcon = key === "services" ? BrandIcon : Icon;
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all",
                    active
                      ? "bg-primary/15 text-primary border border-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface-700"
                  )}
                >
                  <NavIcon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "")} />
                  <span className="flex-1">{label}</span>
                  {active && <ChevronRight className="h-3 w-3 text-primary/50" />}
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
