"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, Scissors, BarChart3,
  Loader2, Tag, ChevronLeft, ChevronRight,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────

interface Goal {
  id:                string;
  revenueTarget:     number | null;
  appointmentTarget: number | null;
  notes:             string | null;
  offDaysOfWeek:     number[];
  extraOffDays:      number[];
  extraWorkDays:     number[];
  workingDaysCount:  number | null;
}

interface ServiceRevenue { name: string; category: string; revenue: number; count: number; }
interface DiscountDay    { day: string; total: number; }
interface DiscountEntry  {
  id: string; customerName: string; serviceName: string;
  date: string; originalAmount: number; discountValue: number; paidValue: number;
}
interface AnnualMonth {
  month: number; label: string; revenue: number; count: number; goal: number | null;
}

interface Props {
  month: number; year: number; monthLabel: string;
  revenueThisMonth: number; revenuePrevMonth: number;
  completedThis: number; completedPrev: number;
  totalAppointmentsThis: number; totalAppointmentsPrev: number;
  avgTicket: number; avgTicketPrev: number;
  goal: Goal | null;
  byService: ServiceRevenue[];
  discountByDay: DiscountDay[];
  discountList: DiscountEntry[];
  totalDiscountMonth: number;
  annualMonths: AnnualMonth[];
  revenueByDay:   Record<number, number>;
  scheduledByDay: Record<number, number>;
}

type Tab = "overview" | "services" | "discounts" | "annual";

const CATEGORY_LABEL: Record<string, string> = {
  HAIRCUT: "Corte", BEARD: "Barba", COMBO: "Combo", TREATMENT: "Tratamento", OTHER: "Outro",
};

const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export function FinanceiroClient({
  month, year,
  revenueThisMonth, revenuePrevMonth,
  completedThis, completedPrev,
  totalAppointmentsThis, totalAppointmentsPrev,
  avgTicket, avgTicketPrev,
  goal,
  byService,
  discountByDay, discountList, totalDiscountMonth,
  annualMonths: initialAnnualMonths,
}: Props) {
  const [tab, setTab] = useState<Tab>("overview");

  // Annual tab state
  const [annualYear,  setAnnualYear]  = useState(year);
  const [annualData,  setAnnualData]  = useState(initialAnnualMonths);
  const [loadingYear, setLoadingYear] = useState(false);

  async function loadYear(y: number) {
    setLoadingYear(true);
    try {
      const res  = await fetch(`/api/financeiro/annual?year=${y}`);
      const data = await res.json();
      setAnnualYear(y);
      setAnnualData(data.months);
    } finally {
      setLoadingYear(false);
    }
  }

  // ── Derived ────────────────────────────────────────────────
  const revenueProgress = goal?.revenueTarget ? Math.min(revenueThisMonth / goal.revenueTarget, 1) : null;
  const revenueDelta    = revenuePrevMonth > 0 ? (revenueThisMonth - revenuePrevMonth) / revenuePrevMonth : null;
  const completedDelta  = completedPrev  > 0 ? (completedThis  - completedPrev)  / completedPrev  : null;
  const ticketDelta     = avgTicketPrev  > 0 ? (avgTicket      - avgTicketPrev)  / avgTicketPrev  : null;
  const maxRevenue      = Math.max(...byService.map((s) => s.revenue), 1);
  const maxDiscountDay  = Math.max(...discountByDay.map((d) => d.total), 1);
  const discountRate    = revenueThisMonth > 0 ? totalDiscountMonth / (revenueThisMonth + totalDiscountMonth) : 0;
  const maxAnnual       = Math.max(...annualData.map((m) => Math.max(m.revenue, m.goal ?? 0)), 1);

  const TABS: [Tab, string, React.ElementType][] = [
    ["overview",  "Visão Geral", BarChart3],
    ["annual",    "Histórico",   TrendingUp],
    ["services",  "Por Serviço", Scissors],
    ["discounts", "Descontos",   Tag],
  ];

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface-800/50 p-1 w-fit">
        {TABS.map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors
              ${tab === key ? "bg-gold-500/15 text-gold-400 border border-gold-500/20" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* ── Visão Geral ─────────────────────────────────── */}
      {tab === "overview" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              label="Receita realizada"
              value={formatBRL(revenueThisMonth)}
              delta={revenueDelta}
              sub={`Mês anterior: ${formatBRL(revenuePrevMonth)}`}
              progress={revenueProgress}
              progressLabel={goal?.revenueTarget ? `Meta: ${formatBRL(goal.revenueTarget)}` : undefined}
            />
            <KpiCard
              label="Atendimentos concluídos"
              value={String(completedThis)}
              delta={completedDelta}
              sub={`Mês anterior: ${completedPrev}`}
            />
            <KpiCard
              label="Ticket médio"
              value={formatBRL(avgTicket)}
              delta={ticketDelta}
              sub={`Mês anterior: ${formatBRL(avgTicketPrev)}`}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-1">Agendamentos (não cancelados)</p>
              <p className="text-2xl font-bold tabular-nums">{totalAppointmentsThis}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Mês anterior: {totalAppointmentsPrev}
                {totalAppointmentsPrev > 0 && (
                  <span className={totalAppointmentsThis >= totalAppointmentsPrev ? " text-emerald-400" : " text-red-400"}>
                    {" "}({totalAppointmentsThis >= totalAppointmentsPrev ? "+" : ""}{Math.round((totalAppointmentsThis - totalAppointmentsPrev) / totalAppointmentsPrev * 100)}%)
                  </span>
                )}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-1">Taxa de conversão</p>
              <p className="text-2xl font-bold tabular-nums">
                {totalAppointmentsThis > 0 ? `${Math.round(completedThis / totalAppointmentsThis * 100)}%` : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{completedThis} de {totalAppointmentsThis}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Histórico Anual ─────────────────────────────── */}
      {tab === "annual" && (
        <div className="space-y-5">
          {/* Year selector */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => loadYear(annualYear - 1)}
              disabled={loadingYear}
              className="rounded-md border border-border p-1.5 hover:bg-surface-700 transition-colors disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-base font-bold text-foreground w-16 text-center tabular-nums">{annualYear}</span>
            <button
              onClick={() => loadYear(annualYear + 1)}
              disabled={loadingYear || annualYear >= year}
              className="rounded-md border border-border p-1.5 hover:bg-surface-700 transition-colors disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {loadingYear && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          {/* KPI totals */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Receita total {annualYear}</p>
              <p className="text-2xl font-bold text-gold-400 tabular-nums">{formatBRL(annualData.reduce((s, m) => s + m.revenue, 0))}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Atendimentos {annualYear}</p>
              <p className="text-2xl font-bold tabular-nums">{annualData.reduce((s, m) => s + m.count, 0)}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Meses com meta</p>
              <p className="text-2xl font-bold tabular-nums">{annualData.filter((m) => m.goal !== null).length}</p>
            </div>
          </div>

          {/* Bar chart */}
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-4">Receita por mês</p>
            <div className="flex items-end gap-2 h-40">
              {annualData.map((m) => {
                const revPct  = (m.revenue / maxAnnual) * 100;
                const goalPct = m.goal ? (m.goal / maxAnnual) * 100 : null;
                const hit     = m.goal && m.revenue >= m.goal;
                const isFuture = annualYear === year && m.month > month;
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex flex-col justify-end h-32 relative">
                      {/* Goal line */}
                      {goalPct !== null && (
                        <div
                          className="absolute w-full border-t-2 border-dashed border-gold-500/50"
                          style={{ bottom: `${goalPct}%` }}
                        />
                      )}
                      {/* Revenue bar */}
                      <div
                        className={`w-full rounded-sm transition-all ${
                          isFuture ? "bg-surface-700" :
                          hit ? "bg-green-500/70" : m.revenue > 0 ? "bg-gold-500/60" : "bg-surface-700"
                        }`}
                        style={{ height: m.revenue > 0 ? `${Math.max(revPct, 4)}%` : "4px" }}
                        title={`${m.label}: ${formatBRL(m.revenue)}${m.goal ? ` / meta ${formatBRL(m.goal)}` : ""}`}
                      />
                    </div>
                    <span className="text-[9px] text-muted-foreground">{m.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-gold-500/60 inline-block" /> Receita</span>
              <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-green-500/70 inline-block" /> Meta atingida</span>
              <span className="flex items-center gap-1"><span className="h-0 w-4 border-t-2 border-dashed border-gold-500/50 inline-block" /> Meta</span>
            </div>
          </div>

          {/* Monthly table */}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-800/50">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Mês</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Atend.</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Receita</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Meta</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {annualData.map((m) => {
                  const pct = m.goal ? Math.round(Math.min(m.revenue / m.goal, 1) * 100) : null;
                  const isCur = annualYear === year && m.month === month;
                  return (
                    <tr key={m.month} className={`hover:bg-surface-800/30 transition-colors ${isCur ? "bg-gold-500/5" : ""}`}>
                      <td className="px-4 py-2.5 font-medium text-foreground text-xs">
                        {MONTH_NAMES[m.month - 1]}
                        {isCur && <span className="ml-1.5 text-[9px] text-gold-400 border border-gold-500/30 rounded px-1">atual</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-xs text-muted-foreground">{m.count || "—"}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-xs font-semibold text-gold-400">{m.revenue > 0 ? formatBRL(m.revenue) : "—"}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-xs text-muted-foreground">{m.goal ? formatBRL(m.goal) : "—"}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                        {pct !== null ? (
                          <span className={pct >= 100 ? "text-green-400 font-semibold" : pct >= 60 ? "text-yellow-400" : "text-red-400"}>
                            {pct}%
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-surface-800/30">
                  <td className="px-4 py-2.5 text-xs font-semibold">Total</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-xs font-semibold">{annualData.reduce((s, m) => s + m.count, 0)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-xs font-bold text-gold-400">{formatBRL(annualData.reduce((s, m) => s + m.revenue, 0))}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-xs text-muted-foreground">{formatBRL(annualData.reduce((s, m) => s + (m.goal ?? 0), 0))}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── Por Serviço ─────────────────────────────────── */}
      {tab === "services" && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {byService.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">Nenhum atendimento concluído este mês.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-800/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Serviço</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Categoria</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Qtd</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Ticket médio</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Receita</th>
                  <th className="px-4 py-3 w-32" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {byService.map((s) => (
                  <tr key={s.name} className="hover:bg-surface-800/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{s.name}</td>
                    <td className="px-4 py-3"><Badge variant="outline" className="text-[10px]">{CATEGORY_LABEL[s.category] ?? s.category}</Badge></td>
                    <td className="px-4 py-3 text-right tabular-nums">{s.count}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatBRL(s.revenue / s.count)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-gold-400">{formatBRL(s.revenue)}</td>
                    <td className="px-4 py-3">
                      <div className="h-1.5 rounded-full bg-surface-700 overflow-hidden">
                        <div className="h-full rounded-full bg-gold-500" style={{ width: `${(s.revenue / maxRevenue) * 100}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-surface-800/30">
                  <td className="px-4 py-3 text-xs font-semibold" colSpan={2}>Total</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{byService.reduce((s, r) => s + r.count, 0)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-muted-foreground">{completedThis > 0 ? formatBRL(byService.reduce((s,r) => s + r.revenue, 0) / byService.reduce((s,r) => s + r.count, 0)) : "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-gold-400">{formatBRL(byService.reduce((s, r) => s + r.revenue, 0))}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}

      {/* ── Descontos ───────────────────────────────────── */}
      {tab === "discounts" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg border border-border bg-card p-4 space-y-1">
              <p className="text-xs text-muted-foreground">Total descontado no mês</p>
              <p className="text-2xl font-bold text-red-400 tabular-nums">{formatBRL(totalDiscountMonth)}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4 space-y-1">
              <p className="text-xs text-muted-foreground">Taxa de desconto</p>
              <p className="text-2xl font-bold tabular-nums">{Math.round(discountRate * 100)}%</p>
              <p className="text-xs text-muted-foreground">do faturamento bruto</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4 space-y-1">
              <p className="text-xs text-muted-foreground">Atendimentos com desconto</p>
              <p className="text-2xl font-bold tabular-nums">{discountList.length}</p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Desconto por dia</p>
            {discountByDay.every((d) => d.total === 0) ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhum desconto aplicado este mês.</p>
            ) : (
              <div className="flex items-end gap-1 h-28 overflow-x-auto pb-2">
                {discountByDay.map((d) => (
                  <div key={d.day} className="flex flex-col items-center gap-1 min-w-[18px] flex-1">
                    <div
                      className="w-full rounded-sm bg-red-500/50 hover:bg-red-500/70 transition-colors relative group"
                      style={{ height: d.total > 0 ? `${Math.max((d.total / maxDiscountDay) * 100, 6)}%` : "2px" }}
                      title={`${d.day}: ${formatBRL(d.total)}`}
                    />
                    <span className="text-[8px] text-muted-foreground">{d.day.split("/")[0]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 bg-surface-800/50 border-b border-border">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Descontos aplicados</p>
            </div>
            {discountList.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-muted-foreground">Nenhum desconto aplicado este mês.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Cliente</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Serviço</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Data</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Original</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Desconto</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Pago</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {discountList.map((d) => (
                    <tr key={d.id} className="hover:bg-surface-800/30 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-foreground">{d.customerName}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{d.serviceName}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{d.date}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatBRL(d.originalAmount)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-red-400 font-medium">-{formatBRL(d.discountValue)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-green-400">{formatBRL(d.paidValue)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-surface-800/30">
                    <td className="px-4 py-2.5 text-xs font-semibold" colSpan={4}>Total</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-bold text-red-400">-{formatBRL(totalDiscountMonth)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-bold text-green-400">{formatBRL(discountList.reduce((s, d) => s + d.paidValue, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function KpiCard({ label, value, delta, sub, progress, progressLabel }: {
  label: string; value: string; delta?: number | null;
  sub?: string; progress?: number | null; progressLabel?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-end gap-2">
        <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
        {delta != null && (
          <span className={`flex items-center gap-0.5 text-xs font-medium mb-0.5 ${delta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(Math.round(delta * 100))}%
          </span>
        )}
      </div>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      {progress != null && (
        <div className="space-y-1 pt-1">
          <ProgressBar value={progress} />
          {progressLabel && <p className="text-[10px] text-muted-foreground">{progressLabel} · {Math.round(progress * 100)}% concluída</p>}
        </div>
      )}
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  const pct   = Math.round(Math.min(value, 1) * 100);
  const color = pct >= 100 ? "bg-emerald-500" : pct >= 70 ? "bg-gold-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="h-1.5 rounded-full bg-surface-700 overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
