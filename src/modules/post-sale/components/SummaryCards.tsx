"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const cards = [
  { key: "emRisco", label: "Clientes em risco" },
  { key: "avalPendentes", label: "Avaliações pendentes" },
  { key: "recentes", label: "Recém-atendidos" },
  { key: "inativos", label: "Inativos" },
  { key: "reativados", label: "Reativados" },
] as const;

export function SummaryCards({ data }: { data: Record<string, number> }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c) => (
        <Card key={c.key} className="border-border/60 bg-surface-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">{c.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-foreground">{data[c.key] ?? 0}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
