"use client";

import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatBRL } from "@/lib/utils";

const AnnualRevenueChart = dynamic(() => import("../charts/annual-revenue-chart"), { ssr: false, loading: () => <ChartSkeleton h={280} /> });
const AnnualYoYChart     = dynamic(() => import("../charts/annual-yoy-chart"),     { ssr: false, loading: () => <ChartSkeleton h={200} /> });

function ChartSkeleton({ h }: { h: number }) {
  return <div className="animate-pulse rounded-lg bg-surface-800" style={{ height: h }} />;
}

interface AnnualMonth {
  month:        number;
  label:        string;
  revenue:      number;
  count:        number;
  avgTicket:    number;
  goal:         number | null;
  cancelledCount: number;
}

interface AnnualData {
  year:         number;
  months:       AnnualMonth[];
  totalRevenue: number;
  totalCount:   number;
  prevYear: {
    totalRevenue: number;
    totalCount:   number;
    months:       AnnualMonth[];
  } | null;
}

const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

interface Props {
  data:         AnnualData;
  currentMonth: number;
  currentYear:  number;
  isLoading?:   boolean;
  onNavigate:   (year: number) => void;
}

export function AnualView({ data, currentMonth, currentYear, isLoading, onNavigate }: Props) {
  const isCurrentYear = data.year === currentYear;

  const totalAvgTicket = data.totalCount > 0 ? data.totalRevenue / data.totalCount : 0;
  const monthsWithGoal = data.months.filter((m) => m.goal != null && m.revenue >= m.goal).length;
  const goalsSet       = data.months.filter((m) => m.goal != null).length;

  const prevHasData = data.prevYear != null && data.prevYear.months.filter((m) => m.revenue > 0).length >= 3;

  // MoM delta for table
  function momDelta(m: AnnualMonth, i: number) {
    if (i === 0) return null;
    const prev = data.months[i - 1].revenue;
    if (prev === 0) return null;
    return ((m.revenue - prev) / prev) * 100;
  }

  return (
    <div className={`space-y-5 transition-opacity ${isLoading ? "opacity-50 pointer-events-none" : ""}`}>

      {/* ── Year navigator ─────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onNavigate(data.year - 1)}
          className="rounded-md border border-border p-2 hover:bg-surface-800 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <p className="text-base font-semibold text-foreground">{data.year}</p>
          {isCurrentYear && (
            <span className="text-[10px] text-gold-400 font-medium">ano atual</span>
          )}
        </div>
        <button
          onClick={() => onNavigate(data.year + 1)}
          disabled={isCurrentYear}
          className="rounded-md border border-border p-2 hover:bg-surface-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-3 sm:p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Receita total</p>
          <p className="text-xl sm:text-2xl font-bold text-gold-400 tabular-nums">{formatBRL(data.totalRevenue)}</p>
          {data.prevYear && data.prevYear.totalRevenue > 0 && (
            <p className={`text-[10px] font-medium ${data.totalRevenue >= data.prevYear.totalRevenue ? "text-emerald-400" : "text-red-400"}`}>
              {data.totalRevenue >= data.prevYear.totalRevenue ? "▲" : "▼"}{" "}
              {Math.abs(((data.totalRevenue - data.prevYear.totalRevenue) / data.prevYear.totalRevenue) * 100).toFixed(1)}%
              {" "}vs {data.year - 1}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-3 sm:p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Atendimentos</p>
          <p className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">{data.totalCount}</p>
          {data.prevYear && data.prevYear.totalCount > 0 && (
            <p className={`text-[10px] font-medium ${data.totalCount >= data.prevYear.totalCount ? "text-emerald-400" : "text-red-400"}`}>
              {data.totalCount >= data.prevYear.totalCount ? "▲" : "▼"}{" "}
              {Math.abs(((data.totalCount - data.prevYear.totalCount) / data.prevYear.totalCount) * 100).toFixed(1)}%
              {" "}vs {data.year - 1}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-3 sm:p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Ticket médio</p>
          <p className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">{formatBRL(totalAvgTicket)}</p>
          <p className="text-[10px] text-muted-foreground">anual consolidado</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-3 sm:p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Meses com meta</p>
          <p className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">
            {goalsSet > 0 ? `${monthsWithGoal} de ${goalsSet}` : "—"}
          </p>
          <p className="text-[10px] text-muted-foreground">meses com meta definida</p>
        </div>
      </div>

      {/* ── Receita mensal (ComposedChart) ─────────────────── */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Receita mensal</p>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-2 w-3 rounded-sm bg-gold-500 inline-block" /> Receita
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-3 rounded-sm bg-emerald-500 inline-block" /> Meta atingida
            </span>
            <span className="flex items-center gap-1">
              <span className="h-[1px] w-3 bg-indigo-400 inline-block" /> Ticket médio
            </span>
          </div>
        </div>
        <AnnualRevenueChart
          months={data.months}
          currentMonth={currentMonth}
          currentYear={currentYear}
          year={data.year}
        />
      </div>

      {/* ── Monthly table ──────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[540px]">
            <thead>
              <tr className="border-b border-border bg-surface-800/50">
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Mês</th>
                <th className="text-right px-3 py-2.5 text-muted-foreground font-medium">Atend.</th>
                <th className="text-right px-3 py-2.5 text-muted-foreground font-medium">Receita</th>
                <th className="text-right px-3 py-2.5 text-muted-foreground font-medium">Ticket médio</th>
                <th className="text-right px-3 py-2.5 text-muted-foreground font-medium">Meta</th>
                <th className="text-right px-3 py-2.5 text-muted-foreground font-medium">%</th>
                <th className="text-right px-3 py-2.5 text-muted-foreground font-medium">vs ant.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.months.map((m, i) => {
                const pct     = m.goal && m.goal > 0 ? Math.round((m.revenue / m.goal) * 100) : null;
                const delta   = momDelta(m, i);
                const isCur   = isCurrentYear && m.month === currentMonth;
                const isFuture = isCurrentYear && m.month > currentMonth;
                return (
                  <tr
                    key={m.month}
                    className={`transition-colors hover:bg-surface-800/20 ${isCur ? "border-l-2 border-l-gold-500 bg-gold-500/5" : ""}`}
                  >
                    <td className={`px-4 py-2.5 font-medium ${isFuture ? "text-muted-foreground/50" : "text-foreground"}`}>
                      {MONTH_NAMES[m.month - 1]}
                      {isCur && <span className="ml-1.5 text-[9px] text-gold-400 border border-gold-500/30 rounded px-1">atual</span>}
                    </td>
                    <td className={`px-3 py-2.5 text-right tabular-nums ${isFuture ? "text-muted-foreground/40" : "text-muted-foreground"}`}>
                      {m.count || "—"}
                    </td>
                    <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${isFuture ? "text-muted-foreground/40" : "text-gold-400"}`}>
                      {m.revenue > 0 ? formatBRL(m.revenue) : "—"}
                    </td>
                    <td className={`px-3 py-2.5 text-right tabular-nums ${isFuture ? "text-muted-foreground/40" : "text-muted-foreground"}`}>
                      {m.avgTicket > 0 ? formatBRL(m.avgTicket) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                      {m.goal ? formatBRL(m.goal) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {pct != null ? (
                        <span className={pct >= 100 ? "text-emerald-400 font-semibold" : pct >= 70 ? "text-amber-400" : pct >= 40 ? "text-orange-400" : "text-red-400"}>
                          {pct}%
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {delta != null ? (
                        <span className={delta >= 0 ? "text-emerald-400" : "text-red-400"}>
                          {delta >= 0 ? "+" : ""}{delta.toFixed(1)}%
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-surface-800/30">
                <td className="px-4 py-2.5 font-semibold text-foreground">Total</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{data.totalCount}</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-bold text-gold-400">{formatBRL(data.totalRevenue)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{formatBRL(totalAvgTicket)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                  {formatBRL(data.months.reduce((s, m) => s + (m.goal ?? 0), 0))}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Comparativo ano anterior ───────────────────────── */}
      {prevHasData && data.prevYear && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">
            Comparativo: {data.year} vs {data.year - 1}
          </p>
          <AnnualYoYChart
            currentYear={data.year}
            currentData={data.months}
            prevYear={data.year - 1}
            prevData={data.prevYear.months}
          />
        </div>
      )}
    </div>
  );
}
