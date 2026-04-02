"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { relativeTime } from "@/lib/utils";
import { AlertTriangle, UserMinus, RefreshCcw, Clock, Ban } from "lucide-react";
import type { CustomerSummary } from "../types";

interface Props {
  rows: CustomerSummary[];
  loading?: boolean;
  onAction?: (customerId: string, action: string) => void;
}

const PS_CONFIG: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  RECENTE:       { label: "Recente",       icon: <Clock       className="h-3 w-3" />, className: "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30" },
  EM_RISCO:      { label: "Em risco",      icon: <AlertTriangle className="h-3 w-3" />, className: "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-orange-500/15 text-orange-400 border border-orange-500/30" },
  INATIVO:       { label: "Inativo",       icon: <UserMinus   className="h-3 w-3" />, className: "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-red-500/15 text-red-400 border border-red-500/30" },
  REATIVADO:     { label: "Reativado",     icon: <RefreshCcw  className="h-3 w-3" />, className: "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" },
  NAO_CONTATAR:  { label: "Não contatar",  icon: <Ban         className="h-3 w-3" />, className: "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-muted/40 text-muted-foreground border border-border" },
};

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const cfg = PS_CONFIG[status];
  if (!cfg) return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] border border-border text-muted-foreground">{status}</span>;
  return <span className={cfg.className}>{cfg.icon}{cfg.label}</span>;
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
              <StatusBadge status={c.postSaleStatus} />
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => onAction?.(c.id, "detail")}>Detalhes</Button>
              <Button size="sm" className="h-8 text-xs" onClick={() => onAction?.(c.id, "contact")}>Enviar msg</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
