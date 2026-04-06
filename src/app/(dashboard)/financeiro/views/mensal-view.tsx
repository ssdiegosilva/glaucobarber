"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus, Tag, ChevronDown, Lightbulb, Target, CreditCard, QrCode, Banknote, HelpCircle, Receipt, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import type { MonthlyData } from "@/lib/financeiro/monthly-data";
import {
  BENCHMARKS, avgTicketStatus, conversionStatus, revenuePerDayStatus,
  type BenchmarkStatus,
} from "@/lib/financeiro/benchmarks";

// ── Recharts (SSR-safe) ───────────────────────────────────────
const DailyRevenueChart   = dynamic(() => import("../charts/daily-revenue-chart"),   { ssr: false, loading: () => <ChartSkeleton h={200} /> });
const ServiceMixDonut     = dynamic(() => import("../charts/service-mix-donut"),     { ssr: false, loading: () => <ChartSkeleton h={180} /> });
const DiscountDailyChart  = dynamic(() => import("../charts/discount-daily-chart"),  { ssr: false, loading: () => <ChartSkeleton h={120} /> });

const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

// ── Helpers ───────────────────────────────────────────────────

function delta(current: number, prev: number) {
  if (prev === 0) return null;
  return ((current - prev) / prev) * 100;
}

function DeltaBadge({ pct, invert = false }: { pct: number | null; invert?: boolean }) {
  if (pct === null) return null;
  const positive = invert ? pct < 0 : pct > 0;
  const color    = Math.abs(pct) < 1 ? "text-muted-foreground" : positive ? "text-emerald-400" : "text-red-400";
  const Icon     = Math.abs(pct) < 1 ? Minus : positive ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${color}`}>
      <Icon className="h-2.5 w-2.5" />
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function ChartSkeleton({ h }: { h: number }) {
  return <div className={`animate-pulse rounded-lg bg-surface-800`} style={{ height: h }} />;
}

function BenchmarkIndicator({ status, label, value, range }: {
  status: BenchmarkStatus; label: string; value: string; range: string;
}) {
  const cfg = {
    good:    { color: "text-emerald-400", icon: "▲", bg: "bg-emerald-500/10" },
    warning: { color: "text-amber-400",   icon: "◆", bg: "bg-amber-500/10"   },
    bad:     { color: "text-red-400",     icon: "▼", bg: "bg-red-500/10"     },
    neutral: { color: "text-muted-foreground", icon: "—", bg: "bg-surface-800" },
  }[status];
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-foreground tabular-nums">{value}</span>
        <span className={`inline-flex items-center gap-1 text-[10px] rounded-full px-1.5 py-0.5 ${cfg.bg} ${cfg.color}`}>
          {cfg.icon} {range}
        </span>
      </div>
    </div>
  );
}

// ── Goal ring (SVG) ───────────────────────────────────────────
function GoalRing({ pct }: { pct: number }) {
  const r   = 44;
  const circ = 2 * Math.PI * r;
  const fill = Math.min(pct, 1);
  const color = pct >= 1 ? "#10b981" : pct >= 0.7 ? "#C9A84C" : pct >= 0.4 ? "#f59e0b" : "#ef4444";
  return (
    <svg width="110" height="110" className="rotate-[-90deg]">
      <circle cx="55" cy="55" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-surface-700" />
      <circle cx="55" cy="55" r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - fill)}
        strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.6s ease" }} />
    </svg>
  );
}

// ── Expense item type ─────────────────────────────────────────
type ExpenseItem = { id: string; label: string; amountCents: number; note: string | null };

// ── Main component ────────────────────────────────────────────

interface Props {
  data:         MonthlyData;
  currentMonth: number;
  currentYear:  number;
  isLoading?:   boolean;
  onNavigate:   (month: number, year: number) => void;
}

export function MensalView({ data, currentMonth, currentYear, isLoading, onNavigate }: Props) {
  const [showDiscounts, setShowDiscounts] = useState(false);
  const [showExpenses,  setShowExpenses]  = useState(false);

  // Local expenses state (syncs when data changes)
  const [expenses, setExpenses] = useState<ExpenseItem[]>(data.expenses.items);
  useEffect(() => { setExpenses(data.expenses.items); }, [data.month, data.year]);

  const expenseTotal = expenses.reduce((s, e) => s + e.amountCents / 100, 0);
  const netRevenue   = data.revenue - expenseTotal;

  // ── Expense form state ──
  type FormMode = { type: "add" } | { type: "edit"; id: string } | null;
  const [formMode,    setFormMode]    = useState<FormMode>(null);
  const [formLabel,   setFormLabel]   = useState("");
  const [formAmount,  setFormAmount]  = useState("");
  const [formNote,    setFormNote]    = useState("");
  const [formSaving,  setFormSaving]  = useState(false);

  function openAdd() {
    setFormMode({ type: "add" });
    setFormLabel(""); setFormAmount(""); setFormNote("");
  }

  function openEdit(e: ExpenseItem) {
    setFormMode({ type: "edit", id: e.id });
    setFormLabel(e.label);
    setFormAmount((e.amountCents / 100).toFixed(2).replace(".", ","));
    setFormNote(e.note ?? "");
  }

  function cancelForm() { setFormMode(null); }

  function parseAmount(raw: string): number {
    return Math.round(parseFloat(raw.replace(",", ".").replace(/[^0-9.]/g, "")) * 100) || 0;
  }

  async function saveExpense() {
    const amountCents = parseAmount(formAmount);
    if (!formLabel.trim() || amountCents <= 0) return;
    setFormSaving(true);
    try {
      if (formMode?.type === "add") {
        const res = await fetch("/api/financeiro/expenses", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ label: formLabel, amountCents, month: data.month, year: data.year, note: formNote || null }),
        });
        if (res.ok) {
          const created = await res.json();
          setExpenses((prev) => [...prev, created]);
        }
      } else if (formMode?.type === "edit") {
        const res = await fetch(`/api/financeiro/expenses/${formMode.id}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ label: formLabel, amountCents, note: formNote || null }),
        });
        if (res.ok) {
          const updated = await res.json();
          setExpenses((prev) => prev.map((e) => e.id === updated.id ? updated : e));
        }
      }
      setFormMode(null);
    } finally {
      setFormSaving(false);
    }
  }

  async function deleteExpense(id: string) {
    const res = await fetch(`/api/financeiro/expenses/${id}`, { method: "DELETE" });
    if (res.ok) setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  const isCurrentMonth = data.month === currentMonth && data.year === currentYear;

  // Navigation
  function prev() {
    const d = new Date(data.year, data.month - 2, 1);
    onNavigate(d.getMonth() + 1, d.getFullYear());
  }
  function next() {
    const d = new Date(data.year, data.month, 1);
    onNavigate(d.getMonth() + 1, d.getFullYear());
  }

  // KPIs
  const conversionRate = data.totalAppointments > 0
    ? data.completedCount / data.totalAppointments : 0;
  const conversionPrev = data.totalAppointmentsPrev > 0
    ? data.completedPrevMonth / data.totalAppointmentsPrev : 0;

  const revenueTarget    = data.goal?.revenueTarget    ?? null;
  const workingDays      = data.goal?.workingDaysCount ?? null;
  const goalPct          = revenueTarget && revenueTarget > 0 ? data.revenue / revenueTarget : null;
  const dailyGoal        = revenueTarget && workingDays && workingDays > 0 ? revenueTarget / workingDays : null;
  const revenuePerDay    = workingDays && workingDays > 0 ? data.revenue / workingDays : null;

  // Projection for current month
  const today = new Date();
  let projection: { amount: number; onTrack: boolean } | null = null;
  if (isCurrentMonth && revenueTarget && workingDays) {
    const dayOfMonth   = today.getDate();
    const daysInMonth  = new Date(data.year, data.month, 0).getDate();
    const elapsed      = dayOfMonth / daysInMonth;
    if (elapsed > 0) {
      const projected = data.revenue / elapsed;
      projection = { amount: projected, onTrack: projected >= revenueTarget };
    }
  }

  // Days remaining
  const daysRemaining = isCurrentMonth
    ? new Date(data.year, data.month, 0).getDate() - today.getDate()
    : 0;
  const revenueRemaining = revenueTarget ? Math.max(0, revenueTarget - data.revenue) : null;
  const dailyRemaining   = daysRemaining > 0 && revenueRemaining ? revenueRemaining / daysRemaining : null;

  return (
    <div className={`space-y-5 transition-opacity ${isLoading ? "opacity-50 pointer-events-none" : ""}`}>

      {/* ── Month navigator ──────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button onClick={prev} className="rounded-md border border-border p-2 hover:bg-surface-800 transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <p className="text-base font-semibold text-foreground">
            {MONTH_NAMES[data.month - 1]} {data.year}
          </p>
          {isCurrentMonth && (
            <span className="text-[10px] text-gold-400 font-medium">mês atual</span>
          )}
        </div>
        <button onClick={next} disabled={isCurrentMonth}
          className="rounded-md border border-border p-2 hover:bg-surface-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* ── KPI Cards ────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Receita */}
        <div className="rounded-xl border border-border bg-card p-3 sm:p-4 space-y-1 col-span-2 sm:col-span-1">
          <p className="text-xs text-muted-foreground">Receita realizada</p>
          <p className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">{formatBRL(data.revenue)}</p>
          <DeltaBadge pct={delta(data.revenue, data.revenuePrevMonth)} />
          {revenueTarget && (
            <div className="pt-1 space-y-1">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Meta: {formatBRL(revenueTarget)}</span>
                <span>{Math.round((goalPct ?? 0) * 100)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-700 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${(goalPct ?? 0) >= 1 ? "bg-emerald-500" : (goalPct ?? 0) >= 0.7 ? "bg-gold-500" : (goalPct ?? 0) >= 0.4 ? "bg-amber-500" : "bg-red-500"}`}
                  style={{ width: `${Math.min((goalPct ?? 0) * 100, 100)}%` }} />
              </div>
              {projection && (
                <p className={`text-[10px] ${projection.onTrack ? "text-emerald-400" : "text-amber-400"}`}>
                  Projetado: {formatBRL(projection.amount)} — {projection.onTrack ? "no caminho ✓" : "abaixo da meta"}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Atendimentos */}
        <div className="rounded-xl border border-border bg-card p-3 sm:p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Atendimentos</p>
          <p className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">{data.completedCount}</p>
          <DeltaBadge pct={delta(data.completedCount, data.completedPrevMonth)} />
          <p className="text-[10px] text-muted-foreground">de {data.totalAppointments} agendados</p>
        </div>

        {/* Ticket médio */}
        <div className="rounded-xl border border-border bg-card p-3 sm:p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Ticket médio</p>
          <p className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">{formatBRL(data.avgTicket)}</p>
          <DeltaBadge pct={delta(data.avgTicket, data.avgTicketPrev)} />
          <p className="text-[10px] text-muted-foreground">Referência: {formatBRL(BENCHMARKS.avgTicket.min)}–{formatBRL(BENCHMARKS.avgTicket.max)}</p>
        </div>

        {/* Conversão */}
        <div className="rounded-xl border border-border bg-card p-3 sm:p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Tx. conversão</p>
          <p className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">{Math.round(conversionRate * 100)}%</p>
          <DeltaBadge pct={delta(conversionRate, conversionPrev)} />
          <p className="text-[10px] text-muted-foreground">Saudável: ≥ 80%</p>
        </div>
      </div>

      {/* ── Receita diária ───────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">Receita diária</p>
        <DailyRevenueChart
          data={data.dailyRevenue}
          scheduledData={data.dailyScheduled}
          dailyGoal={dailyGoal}
          currentDay={isCurrentMonth ? today.getDate() : undefined}
        />
      </div>

      {/* ── Meta + Benchmarks ────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Goal ring */}
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col items-center justify-center gap-3">
          {revenueTarget ? (
            <>
              <p className="text-sm font-semibold text-foreground self-start">Meta do mês</p>
              <div className="relative flex items-center justify-center">
                <GoalRing pct={goalPct ?? 0} />
                <div className="absolute text-center">
                  <p className="text-xl font-bold text-foreground">{Math.round((goalPct ?? 0) * 100)}%</p>
                </div>
              </div>
              <div className="w-full space-y-1 text-xs text-center text-muted-foreground">
                <p>{formatBRL(data.revenue)} de {formatBRL(revenueTarget)}</p>
                {isCurrentMonth && daysRemaining > 0 && dailyRemaining && (
                  <p className="text-[11px]">
                    {daysRemaining} dias restantes · Meta/dia: <span className="text-gold-400 font-medium">{formatBRL(dailyRemaining)}</span>
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-4 space-y-2">
              <Target className="h-8 w-8 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">Sem meta definida</p>
              <p className="text-xs text-muted-foreground">Acesse a aba Metas para definir</p>
            </div>
          )}
        </div>

        {/* Benchmarks */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-gold-400" />
            <p className="text-sm font-semibold text-foreground">Benchmarks do setor</p>
          </div>
          <div className="space-y-0">
            <BenchmarkIndicator
              status={avgTicketStatus(data.avgTicket)}
              label="Ticket médio"
              value={formatBRL(data.avgTicket)}
              range={`R$${BENCHMARKS.avgTicket.min}–${BENCHMARKS.avgTicket.max}`}
            />
            <BenchmarkIndicator
              status={conversionStatus(conversionRate)}
              label="Tx. conversão"
              value={`${Math.round(conversionRate * 100)}%`}
              range="≥ 80%"
            />
            {revenuePerDay !== null && (
              <BenchmarkIndicator
                status={revenuePerDayStatus(revenuePerDay)}
                label="Receita/dia útil"
                value={formatBRL(revenuePerDay)}
                range={`R$${BENCHMARKS.revenuePerDay.min}–${BENCHMARKS.revenuePerDay.max}`}
              />
            )}
            {data.discounts.total > 0 && (
              <BenchmarkIndicator
                status={data.discounts.rate >= BENCHMARKS.discountRate.bad ? "bad" : data.discounts.rate >= BENCHMARKS.discountRate.warning ? "warning" : "good"}
                label="Taxa de desconto"
                value={`${(data.discounts.rate * 100).toFixed(1)}%`}
                range="< 10%"
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Mix de serviços ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Donut */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">Mix por categoria</p>
          {data.byCategory.length > 0
            ? <ServiceMixDonut data={data.byCategory} totalRevenue={data.revenue} />
            : <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">Sem dados</div>
          }
        </div>

        {/* Top services */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">Top serviços</p>
          {data.byService.length === 0
            ? <p className="text-sm text-muted-foreground">Sem atendimentos</p>
            : (
              <div className="space-y-2">
                {data.byService.map((s, i) => {
                  const pct = data.revenue > 0 ? s.revenue / data.revenue : 0;
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-foreground truncate max-w-[60%]">{s.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-muted-foreground">{s.count}×</span>
                          <span className="font-medium text-gold-400 tabular-nums">{formatBRL(s.revenue)}</span>
                        </div>
                      </div>
                      <div className="h-1 rounded-full bg-surface-700 overflow-hidden">
                        <div className="h-full rounded-full bg-gold-500/60" style={{ width: `${pct * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          }
        </div>
      </div>

      {/* ── Formas de pagamento ──────────────────────────── */}
      {data.byPaymentMethod.length > 0 && (() => {
        const METHOD_CFG = {
          CARD: { label: "Cartão",   icon: <CreditCard className="h-3.5 w-3.5" />, color: "bg-blue-500/70",   text: "text-blue-400"   },
          PIX:  { label: "PIX",      icon: <QrCode     className="h-3.5 w-3.5" />, color: "bg-emerald-500/70", text: "text-emerald-400" },
          CASH: { label: "Dinheiro", icon: <Banknote   className="h-3.5 w-3.5" />, color: "bg-gold-500/70",   text: "text-gold-400"   },
          null: { label: "Sem info", icon: <HelpCircle className="h-3.5 w-3.5" />, color: "bg-surface-600",   text: "text-muted-foreground" },
        } as const;
        const totalRecorded = data.byPaymentMethod.reduce((s, r) => s + r.revenue, 0);
        const maxRevenue    = Math.max(...data.byPaymentMethod.map((r) => r.revenue), 0.001);
        return (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Formas de pagamento</p>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {formatBRL(totalRecorded)} registrado
              </span>
            </div>
            <div className="space-y-2.5">
              {data.byPaymentMethod.map((row) => {
                const cfg = METHOD_CFG[row.method ?? "null"] ?? METHOD_CFG["null"];
                const pct = totalRecorded > 0 ? (row.revenue / totalRecorded) * 100 : 0;
                const barPct = (row.revenue / maxRevenue) * 100;
                return (
                  <div key={row.method ?? "null"} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className={`flex items-center gap-1.5 ${cfg.text}`}>
                        {cfg.icon}
                        <span className="font-medium">{cfg.label}</span>
                        <span className="text-muted-foreground">({row.count}×)</span>
                      </div>
                      <div className="flex items-center gap-2 tabular-nums">
                        <span className="text-muted-foreground text-[10px]">{pct.toFixed(0)}%</span>
                        <span className="font-semibold text-foreground">{formatBRL(row.revenue)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-700 overflow-hidden">
                      <div className={`h-full rounded-full ${cfg.color} transition-all duration-500`}
                        style={{ width: `${barPct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            {totalRecorded < data.revenue && (
              <p className="text-[10px] text-muted-foreground">
                {formatBRL(data.revenue - totalRecorded)} sem meio de pagamento registrado
              </p>
            )}
          </div>
        );
      })()}

      {/* ── Receita Líquida ──────────────────────────────── */}
      <div className={`rounded-xl border bg-card p-4 ${netRevenue < 0 ? "border-red-500/40" : "border-emerald-500/30"}`}>
        <div className="flex items-center gap-2 mb-3">
          <Receipt className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Resultado do mês</p>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Receita bruta</span>
            <span className="tabular-nums text-foreground font-medium">{formatBRL(data.revenue)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">(-) Custos</span>
            <span className="tabular-nums text-red-400 font-medium">- {formatBRL(expenseTotal)}</span>
          </div>
          <div className="h-px bg-border my-1" />
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">(=) Receita líquida</span>
            <span className={`text-lg font-bold tabular-nums ${netRevenue >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {formatBRL(netRevenue)}
            </span>
          </div>
          {expenseTotal === 0 && (
            <p className="text-[11px] text-muted-foreground pt-1">
              Nenhum custo registrado — adicione na seção abaixo.
            </p>
          )}
        </div>
      </div>

      {/* ── Custos do mês (colapsável) ────────────────────── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <button
          onClick={() => setShowExpenses((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-800/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Custos do mês</span>
            {expenseTotal > 0
              ? <span className="text-xs text-red-400 font-medium">{formatBRL(expenseTotal)}</span>
              : <span className="text-xs text-muted-foreground">nenhum registrado</span>
            }
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showExpenses ? "rotate-180" : ""}`} />
        </button>

        {showExpenses && (
          <div className="border-t border-border p-4 space-y-3">
            {/* List */}
            {expenses.length > 0 && (
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-surface-800/50">
                      <th className="text-left px-3 py-2 text-muted-foreground font-medium">Descrição</th>
                      <th className="text-left px-3 py-2 text-muted-foreground font-medium hidden sm:table-cell">Obs.</th>
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium">Valor</th>
                      <th className="px-3 py-2 w-16" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {expenses.map((e) => (
                      formMode?.type === "edit" && formMode.id === e.id ? (
                        <tr key={e.id} className="bg-surface-800/30">
                          <td className="px-2 py-1.5">
                            <input
                              className="w-full bg-surface-700 border border-border rounded px-2 py-1 text-xs text-foreground"
                              value={formLabel}
                              onChange={(ev) => setFormLabel(ev.target.value)}
                              placeholder="Descrição"
                              autoFocus
                            />
                          </td>
                          <td className="px-2 py-1.5 hidden sm:table-cell">
                            <input
                              className="w-full bg-surface-700 border border-border rounded px-2 py-1 text-xs text-foreground"
                              value={formNote}
                              onChange={(ev) => setFormNote(ev.target.value)}
                              placeholder="Obs. (opcional)"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              className="w-full bg-surface-700 border border-border rounded px-2 py-1 text-xs text-foreground text-right tabular-nums"
                              value={formAmount}
                              onChange={(ev) => setFormAmount(ev.target.value)}
                              placeholder="0,00"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="flex items-center gap-1 justify-end">
                              <button onClick={saveExpense} disabled={formSaving}
                                className="p-1 rounded text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50">
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={cancelForm}
                                className="p-1 rounded text-muted-foreground hover:bg-surface-700">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={e.id} className="hover:bg-surface-800/20">
                          <td className="px-3 py-2 text-foreground">{e.label}</td>
                          <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">{e.note ?? "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-red-400 font-medium">
                            {formatBRL(e.amountCents / 100)}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1 justify-end">
                              <button onClick={() => openEdit(e)}
                                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-surface-700">
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button onClick={() => deleteExpense(e.id)}
                                className="p-1 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    ))}
                  </tbody>
                  {expenses.length > 1 && (
                    <tfoot>
                      <tr className="border-t border-border bg-surface-800/30">
                        <td colSpan={2} className="px-3 py-2 font-medium text-foreground hidden sm:table-cell">Total</td>
                        <td className="px-3 py-2 text-right tabular-nums text-red-400 font-bold">
                          {formatBRL(expenseTotal)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}

            {/* Add form */}
            {formMode?.type === "add" ? (
              <div className="rounded-lg border border-border bg-surface-800/30 p-3 space-y-2">
                <p className="text-xs font-medium text-foreground">Novo custo</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    className="bg-surface-700 border border-border rounded px-2 py-1.5 text-xs text-foreground sm:col-span-1"
                    value={formLabel}
                    onChange={(e) => setFormLabel(e.target.value)}
                    placeholder="Descrição (ex: Aluguel)"
                    autoFocus
                  />
                  <input
                    className="bg-surface-700 border border-border rounded px-2 py-1.5 text-xs text-foreground"
                    value={formNote}
                    onChange={(e) => setFormNote(e.target.value)}
                    placeholder="Obs. (opcional)"
                  />
                  <input
                    className="bg-surface-700 border border-border rounded px-2 py-1.5 text-xs text-foreground text-right tabular-nums"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="Valor (ex: 1500,00)"
                  />
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <button onClick={cancelForm}
                    className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-surface-700">
                    Cancelar
                  </button>
                  <button
                    onClick={saveExpense}
                    disabled={formSaving || !formLabel.trim() || !formAmount}
                    className="text-xs bg-gold-500 hover:bg-gold-400 text-black font-medium px-3 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {formSaving ? "Salvando…" : "Salvar"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={openAdd}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar custo
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Descontos (colapsável) ────────────────────────── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <button
          onClick={() => setShowDiscounts((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-800/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Descontos</span>
            {data.discounts.total > 0 && (
              <span className="text-xs text-red-400 font-medium">{formatBRL(data.discounts.total)}</span>
            )}
            {data.discounts.total === 0 && (
              <span className="text-xs text-muted-foreground">nenhum este mês</span>
            )}
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showDiscounts ? "rotate-180" : ""}`} />
        </button>

        {showDiscounts && (
          <div className="border-t border-border p-4 space-y-4">
            {/* KPI pills */}
            <div className="flex flex-wrap gap-3">
              <div className="rounded-lg border border-border bg-surface-900 px-3 py-2">
                <p className="text-[10px] text-muted-foreground">Total descontado</p>
                <p className="text-sm font-bold text-red-400">{formatBRL(data.discounts.total)}</p>
              </div>
              <div className="rounded-lg border border-border bg-surface-900 px-3 py-2">
                <p className="text-[10px] text-muted-foreground">Taxa</p>
                <p className="text-sm font-bold text-foreground">{(data.discounts.rate * 100).toFixed(1)}%</p>
              </div>
              <div className="rounded-lg border border-border bg-surface-900 px-3 py-2">
                <p className="text-[10px] text-muted-foreground">Transações</p>
                <p className="text-sm font-bold text-foreground">{data.discounts.count}</p>
              </div>
            </div>

            {data.discounts.total > 0 && (
              <>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Por dia</p>
                  <DiscountDailyChart data={data.discounts.byDay} />
                </div>

                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-surface-800/50">
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium">Cliente</th>
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium hidden sm:table-cell">Serviço</th>
                        <th className="text-right px-3 py-2 text-muted-foreground font-medium">Original</th>
                        <th className="text-right px-3 py-2 text-muted-foreground font-medium">Desconto</th>
                        <th className="text-right px-3 py-2 text-muted-foreground font-medium">Pago</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.discounts.list.map((d) => (
                        <tr key={d.id} className="hover:bg-surface-800/20">
                          <td className="px-3 py-2 text-foreground truncate max-w-[120px]">{d.customerName}</td>
                          <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">{d.serviceName}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatBRL(d.originalAmount)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-red-400">-{formatBRL(d.discountValue)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-foreground">{formatBRL(d.paidValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-border bg-surface-800/30">
                        <td colSpan={2} className="px-3 py-2 text-xs font-medium text-foreground hidden sm:table-cell">Total</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground font-medium">
                          {formatBRL(data.discounts.list.reduce((s, d) => s + d.originalAmount, 0))}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-red-400 font-medium">
                          -{formatBRL(data.discounts.total)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-foreground font-medium">
                          {formatBRL(data.discounts.list.reduce((s, d) => s + d.paidValue, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
