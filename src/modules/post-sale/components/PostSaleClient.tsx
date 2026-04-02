"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/utils";
import type { CustomerSummary } from "../types";

// ── Filter types ──────────────────────────────────────────

type FilterKey = "emRisco" | "avalPendentes" | "recentes" | "inativos" | "reativados";

const FILTER_LABELS: Record<FilterKey, string> = {
  emRisco:       "Clientes em risco",
  avalPendentes: "Avaliações pendentes",
  recentes:      "Recém-atendidos",
  inativos:      "Inativos",
  reativados:    "Reativados",
};

const FILTER_STATUS: Record<FilterKey, string | null> = {
  emRisco:       "EM_RISCO",
  avalPendentes: null,          // reviews tab — handled separately
  recentes:      "RECENTE",
  inativos:      "INATIVO",
  reativados:    "REATIVADO",
};

// ── Summary cards ─────────────────────────────────────────

interface SummaryData {
  emRisco:       number;
  avalPendentes: number;
  recentes:      number;
  inativos:      number;
  reativados:    number;
}

// ── Review item ───────────────────────────────────────────

export interface ReviewItem {
  id:            string;
  customerId:    string;
  appointmentId: string;
  customerName:  string;
  customerPhone?: string | null;
  completedAt?:  string | null;
  serviceName?:  string | null;
  requestStatus: string;
}

// ── Props ─────────────────────────────────────────────────

interface Props {
  summary:   SummaryData;
  customers: CustomerSummary[];
  reviews:   ReviewItem[];
}

export function PostSaleClient({ summary, customers, reviews }: Props) {
  const [active, setActive] = useState<FilterKey | null>(null);

  function toggle(key: FilterKey) {
    setActive((prev) => (prev === key ? null : key));
  }

  // ── Filtered list ────────────────────────────────────────

  let filteredCustomers: CustomerSummary[] = customers;
  let showReviews = false;

  if (active === "avalPendentes") {
    showReviews      = true;
    filteredCustomers = [];
  } else if (active && FILTER_STATUS[active]) {
    const status = FILTER_STATUS[active];
    filteredCustomers = customers.filter((c) => c.postSaleStatus === status);
  }

  return (
    <div className="space-y-5">
      {/* Summary cards — act as filter toggles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {(Object.keys(FILTER_LABELS) as FilterKey[]).map((key) => {
          const isActive = active === key;
          const count    = summary[key];
          return (
            <button
              key={key}
              onClick={() => toggle(key)}
              className={`rounded-lg border text-left p-4 transition-all focus:outline-none focus:ring-2 focus:ring-ring
                ${isActive
                  ? "border-gold-500/60 bg-gold-500/10 shadow-[0_0_0_1px_rgba(234,179,8,0.25)]"
                  : "border-border/60 bg-surface-900 hover:border-border"}`}
            >
              <p className={`text-xs mb-1.5 ${isActive ? "text-gold-400" : "text-muted-foreground"}`}>
                {FILTER_LABELS[key]}
              </p>
              <p className={`text-2xl font-semibold tabular-nums ${isActive ? "text-gold-400" : "text-foreground"}`}>
                {count}
              </p>
              {isActive && (
                <p className="text-[10px] text-gold-400/70 mt-1">filtro ativo · clique para limpar</p>
              )}
            </button>
          );
        })}
      </div>

      {/* Results */}
      {showReviews ? (
        <ReviewList reviews={reviews} />
      ) : (
        <CustomerList
          rows={filteredCustomers}
          emptyMessage={
            active
              ? `Nenhum cliente em "${FILTER_LABELS[active]}".`
              : "Selecione um filtro acima para ver os clientes."
          }
          showAll={!active}
        />
      )}
    </div>
  );
}

// ── Customer list ─────────────────────────────────────────

function CustomerList({
  rows, emptyMessage, showAll,
}: {
  rows: CustomerSummary[];
  emptyMessage: string;
  showAll: boolean;
}) {
  const display = showAll ? rows.slice(0, 30) : rows;

  if (display.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {showAll && (
        <p className="text-xs text-muted-foreground">
          Mostrando todos os clientes com status pós-venda. Clique em uma caixa acima para filtrar.
        </p>
      )}
      {display.map((c) => (
        <div key={c.id} className="rounded-lg border border-border/60 bg-surface-900">
          <div className="py-3 px-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
              <div className="text-xs text-muted-foreground flex flex-wrap gap-2 mt-0.5">
                {c.phone && <span>{c.phone}</span>}
                {c.lastVisitAt && <span>Última: {relativeTime(c.lastVisitAt)}</span>}
                {c.serviceName && <span>{c.serviceName}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {c.postSaleStatus && (
                <Badge variant="outline" className={`text-[10px] ${statusBadgeClass(c.postSaleStatus)}`}>
                  {statusLabel(c.postSaleStatus)}
                </Badge>
              )}
              <Button size="sm" variant="ghost" className="h-7 text-xs">Detalhes</Button>
              <Button size="sm" className="h-7 text-xs">Enviar msg</Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Review list ───────────────────────────────────────────

function ReviewList({ reviews }: { reviews: ReviewItem[] }) {
  if (reviews.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
        Nenhuma avaliação pendente nas últimas 48h.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Clientes atendidos nas últimas 48h aguardando solicitação de avaliação Google.</p>
      {reviews.map((r) => (
        <div key={r.id} className="rounded-lg border border-border/60 bg-surface-900">
          <div className="py-3 px-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{r.customerName}</p>
              <div className="text-xs text-muted-foreground flex flex-wrap gap-2 mt-0.5">
                {r.customerPhone && <span>{r.customerPhone}</span>}
                {r.completedAt && <span>Atendido {relativeTime(r.completedAt)}</span>}
                {r.serviceName && <span>{r.serviceName}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-400/30">Pendente</Badge>
              <Button size="sm" className="h-7 text-xs">Pedir avaliação</Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────

function statusLabel(s: string) {
  const map: Record<string, string> = {
    RECENTE:      "Recente",
    EM_RISCO:     "Em risco",
    INATIVO:      "Inativo",
    REATIVADO:    "Reativado",
    NAO_CONTATAR: "Não contatar",
  };
  return map[s] ?? s;
}

function statusBadgeClass(s: string) {
  const map: Record<string, string> = {
    RECENTE:      "text-emerald-400 border-emerald-400/30",
    EM_RISCO:     "text-amber-400 border-amber-400/30",
    INATIVO:      "text-red-400 border-red-400/30",
    REATIVADO:    "text-blue-400 border-blue-400/30",
    NAO_CONTATAR: "text-muted-foreground",
  };
  return map[s] ?? "";
}
