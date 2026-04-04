"use client";

import { useEffect, useState } from "react";
import { Sparkles, Zap, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function AiLimitModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleEvent() { setOpen(true); }
    window.addEventListener("ai-limit-reached", handleEvent);
    return () => window.removeEventListener("ai-limit-reached", handleEvent);
  }, []);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 z-50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Modal */}
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[60] rounded-2xl border border-purple-500/30 bg-card shadow-2xl p-6 max-w-sm mx-auto space-y-5">
        {/* Close */}
        <button
          onClick={() => setOpen(false)}
          className="absolute top-4 right-4 rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Icon */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="h-16 w-16 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-purple-400" />
            </div>
            <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
              <Zap className="h-3 w-3 text-amber-400" />
            </div>
          </div>
        </div>

        {/* Text */}
        <div className="text-center space-y-2">
          <h3 className="text-base font-bold text-foreground">Limite de IA atingido</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Você usou todos os créditos de IA do seu plano este mês.
            Adicione créditos extras para continuar gerando campanhas, imagens e análises.
          </p>
        </div>

        {/* Credits info */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 space-y-1">
          <p className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
            <Zap className="h-3 w-3" />
            Créditos extras
          </p>
          <p className="text-xs text-muted-foreground">
            Nunca expiram — ficam na sua reserva e são usados automaticamente quando o plano mensal esgotar.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Button
            asChild
            className="w-full bg-purple-600 hover:bg-purple-500 text-white gap-2"
            onClick={() => setOpen(false)}
          >
            <Link href="/billing">
              <Zap className="h-4 w-4" />
              Comprar créditos
              <ExternalLink className="h-3 w-3 opacity-60" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            className="w-full text-sm text-muted-foreground"
            onClick={() => setOpen(false)}
          >
            Fechar
          </Button>
        </div>
      </div>
    </>
  );
}
