"use client";

import { Bell, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/utils";

interface HeaderProps {
  title:     string;
  subtitle?: string;
  userName?: string | null;
  actions?:  React.ReactNode;
}

export function Header({ title, subtitle, userName, actions }: HeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-4 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
      <div>
        <h1 className="text-lg font-bold text-foreground">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {actions}

        <Button variant="ghost" size="icon-sm" className="relative text-muted-foreground">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-gold-400" />
        </Button>

        {/* Avatar */}
        {userName && (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-500/20 border border-gold-500/30 text-xs font-bold text-gold-400">
            {getInitials(userName)}
          </div>
        )}
      </div>
    </header>
  );
}
