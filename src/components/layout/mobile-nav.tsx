"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "./sidebar";
import { Scissors, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileNavProps {
  barbershopName?: string | null;
}

export function MobileNav({ barbershopName }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="md:hidden sticky top-0 z-30">
      <div className="flex items-center justify-between bg-card/90 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-500/15 border border-gold-500/30">
            <Scissors className="h-4 w-4 text-gold-400" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-foreground">{barbershopName ?? "GlaucoBarber"}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Copiloto IA</p>
          </div>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Abrir menu"
          className="rounded-md border border-border bg-surface-900 p-2 text-foreground"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

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
        </div>
      )}
    </div>
  );
}
