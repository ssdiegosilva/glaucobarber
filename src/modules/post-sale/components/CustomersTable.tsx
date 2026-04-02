"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { relativeTime } from "@/lib/utils";
import type { CustomerSummary } from "../types";

interface Props {
  rows: CustomerSummary[];
  loading?: boolean;
  onAction?: (customerId: string, action: string) => void;
}

export function CustomersTable({ rows, loading, onAction }: Props) {
  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!rows.length) return <p className="text-sm text-muted-foreground">Nenhum cliente aqui.</p>;

  return (
    <div className="space-y-2">
      {rows.map((c) => (
        <Card key={c.id} className="border-border/60 bg-surface-900">
          <CardContent className="py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">{c.name}</p>
              <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                {c.phone && <span>{c.phone}</span>}
                {c.lastVisitAt && <span>Última: {relativeTime(c.lastVisitAt)}</span>}
                {c.serviceName && <span>{c.serviceName}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">{c.postSaleStatus}</Badge>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => onAction?.(c.id, "detail")}>Detalhes</Button>
              <Button size="sm" className="h-8 text-xs" onClick={() => onAction?.(c.id, "contact")}>Enviar msg</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
