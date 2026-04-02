"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Star, Clock, UserMinus, RefreshCcw, HelpCircle } from "lucide-react";
import { useState } from "react";

const cards = [
  {
    key:         "emRisco",
    label:       "Clientes em risco",
    tab:         "risk",
    icon:        <AlertTriangle className="h-4 w-4 text-orange-400" />,
    iconBg:      "bg-orange-500/10 border-orange-500/20",
    tooltip:     "Clientes que visitaram entre 14 e 60 dias atrás e não têm agendamento futuro. Risco de perda — contato imediato recomendado.",
  },
  {
    key:         "avalPendentes",
    label:       "Avaliações pendentes",
    tab:         "reviews",
    icon:        <Star className="h-4 w-4 text-yellow-400" />,
    iconBg:      "bg-yellow-500/10 border-yellow-500/20",
    tooltip:     "Clientes atendidos nas últimas 48h que ainda não receberam uma solicitação de avaliação Google e não optaram por não ser contatados.",
  },
  {
    key:         "recentes",
    label:       "Recém-atendidos",
    tab:         "recent",
    icon:        <Clock className="h-4 w-4 text-blue-400" />,
    iconBg:      "bg-blue-500/10 border-blue-500/20",
    tooltip:     "Clientes que concluíram um atendimento nos últimos 14 dias. Status positivo — acompanhamento para fidelização.",
  },
  {
    key:         "inativos",
    label:       "Inativos",
    tab:         "inactive",
    icon:        <UserMinus className="h-4 w-4 text-red-400" />,
    iconBg:      "bg-red-500/10 border-red-500/20",
    tooltip:     "Clientes sem visita há mais de 60 dias. Alta prioridade para campanhas de reativação com oferta ou mensagem personalizada.",
  },
  {
    key:         "reativados",
    label:       "Reativados",
    tab:         null,
    icon:        <RefreshCcw className="h-4 w-4 text-green-400" />,
    iconBg:      "bg-green-500/10 border-green-500/20",
    tooltip:     "Clientes que estavam inativos e voltaram nos últimos 60 dias. Excelente sinal — continue o engajamento para fidelizá-los.",
  },
] as const;

function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        aria-label="Saiba mais"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-56 rounded-md border border-border bg-surface-800 px-3 py-2 text-[11px] text-muted-foreground shadow-lg leading-relaxed pointer-events-none">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-border" />
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
        const content = (
          <Card key={c.key} className="border-border/60 bg-surface-900 hover:border-gold-500/40 transition-colors cursor-pointer">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className={`inline-flex items-center justify-center rounded-md border p-1 ${c.iconBg}`}>
                    {c.icon}
                  </span>
                  <CardTitle className="text-xs text-muted-foreground leading-tight">{c.label}</CardTitle>
                </div>
                <Tooltip text={c.tooltip} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-foreground">{data[c.key] ?? 0}</p>
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
