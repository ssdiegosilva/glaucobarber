"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Star, Clock, UserMinus, RefreshCcw, Lightbulb, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const cards = [
  {
    key:        "emRisco",
    label:      "Clientes em risco",
    tab:        "risk",
    icon:       <AlertTriangle className="h-4 w-4 text-orange-400" />,
    iconBg:     "bg-orange-500/10 border-orange-500/20",
    cardBorder: "border-orange-500/40",
    cardBg:     "bg-orange-500/5",
    numColor:   "text-orange-400",
    tooltip:    "Clientes que visitaram entre 14 e 60 dias atrás e não têm agendamento futuro. Risco de perda — contato imediato recomendado.",
  },
  {
    key:        "avalPendentes",
    label:      "Avaliações pendentes",
    tab:        "reviews",
    icon:       <Star className="h-4 w-4 text-yellow-400" />,
    iconBg:     "bg-yellow-500/10 border-yellow-500/20",
    cardBorder: "border-yellow-500/40",
    cardBg:     "bg-yellow-500/5",
    numColor:   "text-yellow-400",
    tooltip:    "Clientes atendidos nas últimas 48h que ainda não receberam uma solicitação de avaliação Google e não optaram por não ser contatados.",
  },
  {
    key:        "recentes",
    label:      "Recém-atendidos",
    tab:        "recent",
    icon:       <Clock className="h-4 w-4 text-blue-400" />,
    iconBg:     "bg-blue-500/10 border-blue-500/20",
    cardBorder: "border-blue-500/40",
    cardBg:     "bg-blue-500/5",
    numColor:   "text-blue-400",
    tooltip:    "Clientes que concluíram um atendimento nos últimos 14 dias. Status positivo — acompanhamento para fidelização.",
  },
  {
    key:        "inativos",
    label:      "Inativos",
    tab:        "inactive",
    icon:       <UserMinus className="h-4 w-4 text-red-400" />,
    iconBg:     "bg-red-500/10 border-red-500/20",
    cardBorder: "border-red-500/40",
    cardBg:     "bg-red-500/5",
    numColor:   "text-red-400",
    tooltip:    "Clientes sem visita há mais de 60 dias. Alta prioridade para campanhas de reativação com oferta ou mensagem personalizada.",
  },
  {
    key:        "reativados",
    label:      "Reativados",
    tab:        null,
    icon:       <RefreshCcw className="h-4 w-4 text-green-400" />,
    iconBg:     "bg-green-500/10 border-green-500/20",
    cardBorder: "border-green-500/40",
    cardBg:     "bg-green-500/5",
    numColor:   "text-green-400",
    tooltip:    "Clientes que estavam inativos e voltaram nos últimos 60 dias. Excelente sinal — continue o engajamento para fidelizá-los.",
  },
] as const;

function CriteriaTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOut(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOut);
    return () => document.removeEventListener("mousedown", onOut);
  }, [open]);

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        className="text-muted-foreground/50 hover:text-gold-400 transition-colors"
        aria-label="Ver critério"
      >
        <Lightbulb className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute bottom-full right-0 mb-2 z-50 w-60 rounded-lg border border-border bg-card shadow-xl px-3 py-2.5 text-[11px] text-muted-foreground leading-relaxed">
          <div className="flex items-start gap-2">
            <Lightbulb className="h-3 w-3 text-gold-400 shrink-0 mt-0.5" />
            <p>{text}</p>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(false); }}
              className="shrink-0 text-muted-foreground/50 hover:text-foreground ml-1"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <div className="absolute top-full right-3 border-4 border-transparent border-t-border" />
        </div>
      )}
    </div>
  );
}

export function SummaryCards({ data }: { data: Record<string, number> }) {
  const pathname = usePathname();

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c) => {
        const value = data[c.key] ?? 0;
        const content = (
          <Card
            key={c.key}
            className={`transition-all cursor-pointer hover:scale-[1.02] ${
              value > 0
                ? `${c.cardBorder} ${c.cardBg}`
                : "border-border/60 bg-surface-900"
            }`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className={`inline-flex items-center justify-center rounded-md border p-1 ${c.iconBg}`}>
                    {c.icon}
                  </span>
                  <CardTitle className="text-xs text-muted-foreground leading-tight">{c.label}</CardTitle>
                </div>
                <CriteriaTooltip text={c.tooltip} />
              </div>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${value > 0 ? c.numColor : "text-muted-foreground"}`}>
                {value}
              </p>
            </CardContent>
          </Card>
        );

        return c.tab ? (
          <Link key={c.key} href={`${pathname}?tab=${c.tab}`} className="block">
            {content}
          </Link>
        ) : (
          <div key={c.key}>{content}</div>
        );
      })}
    </div>
  );
}
