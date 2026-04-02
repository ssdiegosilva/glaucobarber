"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const cards = [
  { key: "emRisco",       label: "Clientes em risco",  tab: "risk"    },
  { key: "avalPendentes", label: "Avaliações pendentes", tab: "reviews" },
  { key: "recentes",      label: "Recém-atendidos",    tab: "recent"  },
  { key: "inativos",      label: "Inativos",           tab: "inactive"},
  { key: "reativados",    label: "Reativados",         tab: null      },
] as const;

export function SummaryCards({ data }: { data: Record<string, number> }) {
  const pathname = usePathname();

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c) => {
        const content = (
          <Card key={c.key} className="border-border/60 bg-surface-900 hover:border-gold-500/40 transition-colors cursor-pointer">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground">{c.label}</CardTitle>
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
