"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  icon: ReactNode;
  title: string;
  description?: string;
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function CollapsibleSection({ icon, title, description, badge, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-4 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="h-8 w-8 rounded-lg bg-muted/60 border border-border flex items-center justify-center shrink-0 text-muted-foreground">
          {icon}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {description && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{description}</p>
          )}
        </div>

        {badge && <div className="shrink-0">{badge}</div>}

        <ChevronDown
          className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="px-3 sm:px-5 pb-4 sm:pb-5 pt-1 border-t border-border/40">
          {children}
        </div>
      )}
    </div>
  );
}
