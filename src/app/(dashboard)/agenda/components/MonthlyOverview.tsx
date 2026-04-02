"use client";

import { useState, useEffect } from "react";
import { formatBRL } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MonthStat {
  month:            number;
  label:            string;
  totalCount:       number;
  completedCount:   number;
  cancelledCount:   number;
  noShowCount:      number;
  revenueCompleted: number;
  revenueProjected: number;
  occupancyRate:    number;
  avgTicket:        number;
  isPast:           boolean;
}

interface Props {
  initialYear: number;
}

export function MonthlyOverview({ initialYear }: Props) {
  const [year, setYear]     = useState(initialYear);
  const [data, setData]     = useState<MonthStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/agenda/monthly-stats?year=${year}`)
      .then((r) => r.json())
      .then((d) => setData(d.months ?? []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [year]);

  const maxRevenue    = Math.max(...data.map((m) => Math.max(m.revenueCompleted, m.revenueProjected)), 1);
  const maxCount      = Math.max(...data.map((m) => m.totalCount), 1);
  const currentMonth  = new Date().getMonth() + 1;
  const currentYear   = new Date().getFullYear();

  return (
    <div className="space-y-6">
      {/* Year navigation */}
      <div className="flex items-center gap-3">
        <Button size="sm" variant="outline" onClick={() => setYear((y) => y - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-lg font-semibold text-foreground tabular-nums">{year}</span>
        <Button size="sm" variant="outline" onClick={() => setYear((y) => y + 1)} disabled={year >= currentYear + 1}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {!loading && data.length > 0 && (
        <>
          {/* Revenue chart */}
          <ChartSection title="Faturamento por mês" subtitle="Barras verdes = realizado · Barras cinzas = previsto">
            <BarChart
              months={data}
              currentMonth={currentMonth}
              currentYear={currentYear}
              year={year}
              getValue={(m) => m.revenueCompleted}
              getProjected={(m) => m.revenueProjected}
              max={maxRevenue}
              formatValue={(v) => formatBRL(v)}
              color="emerald"
            />
          </ChartSection>

          {/* Occupancy chart */}
          <ChartSection title="Taxa de ocupação por mês" subtitle="Percentual de horários preenchidos vs. capacidade estimada">
            <BarChart
              months={data}
              currentMonth={currentMonth}
              currentYear={currentYear}
              year={year}
              getValue={(m) => m.occupancyRate}
              max={1}
              formatValue={(v) => `${Math.round(v * 100)}%`}
              color="gold"
            />
          </ChartSection>

          {/* Appointments count chart */}
          <ChartSection title="Atendimentos por mês" subtitle="Total · Concluídos · Cancelamentos · No-show">
            <CountChart months={data} currentMonth={currentMonth} currentYear={currentYear} year={year} maxCount={maxCount} />
          </ChartSection>

          {/* Summary table */}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-surface-800/50">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Resumo anual</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-2 text-muted-foreground font-medium">Mês</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-medium">Agendamentos</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-medium">Concluídos</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-medium">Cancelados</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-medium">No-show</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-medium">Faturado</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-medium">Ticket médio</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-medium">Ocupação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {data.map((m) => {
                    const isCurrent = m.month === currentMonth && year === currentYear;
                    return (
                      <tr key={m.month} className={isCurrent ? "bg-gold-500/5" : "hover:bg-surface-800/30"}>
                        <td className="px-4 py-2 font-medium text-foreground">
                          {m.label} {isCurrent && <span className="text-gold-400 text-[10px]">• agora</span>}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-foreground">{m.totalCount}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-emerald-400">{m.completedCount}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-red-400">{m.cancelledCount || "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-orange-400">{m.noShowCount || "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-foreground">{m.revenueCompleted > 0 ? formatBRL(m.revenueCompleted) : "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{m.avgTicket > 0 ? formatBRL(m.avgTicket) : "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-foreground">
                          {m.occupancyRate > 0 ? `${Math.round(m.occupancyRate * 100)}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t border-border bg-surface-800/30">
                  <tr>
                    <td className="px-4 py-2 font-semibold text-foreground">Total</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-foreground">{data.reduce((s, m) => s + m.totalCount, 0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-400">{data.reduce((s, m) => s + m.completedCount, 0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-red-400">{data.reduce((s, m) => s + m.cancelledCount, 0) || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-orange-400">{data.reduce((s, m) => s + m.noShowCount, 0) || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-foreground">{formatBRL(data.reduce((s, m) => s + m.revenueCompleted, 0))}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">—</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">—</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────

function ChartSection({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function BarChart({
  months, currentMonth, currentYear, year, getValue, getProjected, max, formatValue, color,
}: {
  months:       MonthStat[];
  currentMonth: number;
  currentYear:  number;
  year:         number;
  getValue:     (m: MonthStat) => number;
  getProjected?: (m: MonthStat) => number;
  max:          number;
  formatValue:  (v: number) => string;
  color:        "emerald" | "gold";
}) {
  const colorClass    = color === "emerald" ? "bg-emerald-500"      : "bg-gold-500";
  const projClass     = "bg-muted/40";
  const hoverClass    = color === "emerald" ? "group-hover:bg-emerald-400" : "group-hover:bg-gold-400";

  return (
    <div className="flex items-end gap-1 h-32">
      {months.map((m) => {
        const isCurrent = m.month === currentMonth && year === currentYear;
        const val       = getValue(m);
        const projected = getProjected?.(m) ?? 0;
        const valPct    = Math.round((val / max) * 100);
        const projPct   = projected > 0 ? Math.round(((val + projected) / max) * 100) : 0;

        return (
          <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group relative">
            {/* Tooltip */}
            <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center z-10">
              <div className="bg-card border border-border rounded px-2 py-1 text-[10px] text-foreground whitespace-nowrap shadow-lg">
                <p className="font-medium">{m.label}</p>
                <p className="text-emerald-400">{formatValue(val)}</p>
                {projected > 0 && <p className="text-muted-foreground">+ {formatValue(projected)} previsto</p>}
              </div>
            </div>

            {/* Bar stack */}
            <div className="w-full flex flex-col justify-end" style={{ height: "96px" }}>
              {projPct > valPct && (
                <div className={`w-full rounded-t-sm ${projClass} transition-all`} style={{ height: `${projPct - valPct}%` }} />
              )}
              <div
                className={`w-full ${valPct > 0 ? "rounded-t-sm" : ""} ${colorClass} ${hoverClass} transition-all`}
                style={{ height: `${Math.max(valPct, val > 0 ? 2 : 0)}%` }}
              />
            </div>

            {/* Label */}
            <span className={`text-[10px] tabular-nums ${isCurrent ? "text-gold-400 font-semibold" : "text-muted-foreground"}`}>
              {m.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function CountChart({
  months, currentMonth, currentYear, year, maxCount,
}: {
  months:       MonthStat[];
  currentMonth: number;
  currentYear:  number;
  year:         number;
  maxCount:     number;
}) {
  return (
    <div className="flex items-end gap-1 h-32">
      {months.map((m) => {
        const isCurrent    = m.month === currentMonth && year === currentYear;
        const totalPct     = Math.round((m.totalCount / maxCount) * 100);
        const completedPct = Math.round((m.completedCount / maxCount) * 100);
        const cancelledPct = Math.round((m.cancelledCount / maxCount) * 100);
        const noShowPct    = Math.round((m.noShowCount / maxCount) * 100);

        return (
          <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center z-10">
              <div className="bg-card border border-border rounded px-2 py-1 text-[10px] text-foreground whitespace-nowrap shadow-lg">
                <p className="font-medium">{m.label}</p>
                <p className="text-emerald-400">Concluídos: {m.completedCount}</p>
                {m.cancelledCount > 0 && <p className="text-red-400">Cancelados: {m.cancelledCount}</p>}
                {m.noShowCount > 0 && <p className="text-orange-400">No-show: {m.noShowCount}</p>}
                <p className="text-muted-foreground">Total: {m.totalCount}</p>
              </div>
            </div>

            <div className="w-full flex flex-col justify-end rounded-t-sm overflow-hidden" style={{ height: "96px" }}>
              {/* Stacked: completed (green) + cancelled (red) + no-show (orange) */}
              {noShowPct > 0 && (
                <div className="w-full bg-orange-500/60" style={{ height: `${noShowPct}%` }} />
              )}
              {cancelledPct > 0 && (
                <div className="w-full bg-red-500/60" style={{ height: `${cancelledPct}%` }} />
              )}
              <div className="w-full bg-blue-500/50 transition-all" style={{ height: `${Math.max(completedPct, m.completedCount > 0 ? 2 : 0)}%` }} />
            </div>

            <span className={`text-[10px] tabular-nums ${isCurrent ? "text-gold-400 font-semibold" : "text-muted-foreground"}`}>
              {m.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
