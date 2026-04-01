"use client";

import { Bell, RefreshCw, LogOut, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface HeaderProps {
  title:     string;
  subtitle?: string;
  userName?: string | null;
  actions?:  React.ReactNode;
}

export function Header({ title, subtitle, userName, actions }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

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
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-500/20 border border-gold-500/30 text-xs font-bold text-gold-400"
            >
              {getInitials(userName)}
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-44 rounded-lg border border-border bg-card shadow-lg p-1 text-sm">
                <Link
                  href="/settings"
                  className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-surface-800 text-foreground"
                  onClick={() => setMenuOpen(false)}
                >
                  <PencilLine className="h-4 w-4" />
                  Editar perfil
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-surface-800 text-left text-foreground"
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
