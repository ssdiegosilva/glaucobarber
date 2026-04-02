"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";

const POLL_MS = 30_000;

interface Props {
  initialUsed:    number;
  initialLimit:   number;
  initialCredits: number;
}

export function AiUsageWidget({ initialUsed, initialLimit, initialCredits }: Props) {
  const [used,    setUsed]    = useState(initialUsed);
  const [limit,   setLimit]   = useState(initialLimit);
  const [credits, setCredits] = useState(initialCredits);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/ai/usage");
      if (!res.ok) return;
      const data = await res.json();
      setUsed(data.used);
      setLimit(data.limit);
      setCredits(data.credits);
    } catch {}
  }

  useEffect(() => {
    // Poll a cada 30s
    timer.current = setInterval(refresh, POLL_MS);

    // Atualiza imediatamente quando qualquer chamada de IA termina
    window.addEventListener("ai-used", refresh);

    return () => {
      if (timer.current) clearInterval(timer.current);
      window.removeEventListener("ai-used", refresh);
    };
  }, []);

  const total     = limit + credits;
  const pct       = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 100;
  const remaining = Math.max(0, total - used);
  const isLow     = pct >= 80;
  const isOut     = pct >= 100;

  return (
    <Link
      href="/billing"
      className="mt-6 mx-1 rounded-lg bg-gold-500/8 border border-gold-500/15 p-3 block hover:bg-gold-500/12 transition-colors"
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <Sparkles className={`h-3.5 w-3.5 ${isOut ? "text-red-400" : isLow ? "text-amber-400" : "text-gold-400"}`} />
          <span className={`text-xs font-semibold ${isOut ? "text-red-400" : isLow ? "text-amber-400" : "text-gold-400"}`}>
            {isOut ? "IA Esgotada" : "IA"}
          </span>
        </div>
        <span className={`text-[10px] ${isOut ? "text-red-400" : "text-muted-foreground"}`}>
          {used}/{total}
        </span>
      </div>
      <div className="h-1 rounded-full bg-surface-700 overflow-hidden mb-1.5">
        <div
          className={`h-full rounded-full transition-all duration-500 ${isOut ? "bg-red-500" : isLow ? "bg-amber-500" : "bg-gold-500"}`}
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
}
