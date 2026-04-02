"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/utils";
import { TrendingUp, TrendingDown, Target, Scissors, BarChart3, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

// ── Types ────────────────────────────────────────────────────

interface Goal {
  id: string;
  revenueTarget:     number | null;
  appointmentTarget: number | null;
  notes:             string | null;
}

interface ServiceRevenue {
  name:     string;
  category: string;
  revenue:  number;
  count:    number;
}

interface Props {
  month:                 number;
  year:                  number;
  monthLabel:            string;
  revenueThisMonth:      number;
  revenuePrevMonth:      number;
  completedThis:         number;
  completedPrev:         number;
  totalAppointmentsThis: number;
  totalAppointmentsPrev: number;
  avgTicket:             number;
  avgTicketPrev:         number;
  goal:                  Goal | null;
  byService:             ServiceRevenue[];
}

type Tab = "overview" | "goals" | "services";

const CATEGORY_LABEL: Record<string, string> = {
  HAIRCUT: "Corte", BEARD: "Barba", COMBO: "Combo", TREATMENT: "Tratamento", OTHER: "Outro",
};

export function FinanceiroClient({
  month, year, monthLabel,
  revenueThisMonth, revenuePrevMonth,
  completedThis, completedPrev,
  totalAppointmentsThis, totalAppointmentsPrev,
  avgTicket, avgTicketPrev,
  goal: initialGoal,
  byService,
}: Props) {
  const [tab, setTab]   = useState<Tab>("overview");
  const [goal, setGoal] = useState<Goal | null>(initialGoal);

  // Goal form state
  const [revenueTarget, setRevenueTarget]         = useState(initialGoal?.revenueTarget ? String(initialGoal.revenueTarget) : "");
  const [appointmentTarget, setAppointmentTarget] = useState(initialGoal?.appointmentTarget ? String(initialGoal.appointmentTarget) : "");
  const [notes, setNotes]                         = useState(initialGoal?.notes ?? "");
  const [savingGoal, setSavingGoal]               = useState(false);

  async function handleSaveGoal() {
    setSavingGoal(true);
    try {
      const res = await fetch("/api/goals", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          month,
          year,
          revenueTarget:     revenueTarget ? Number(revenueTarget) : null,
          appointmentTarget: appointmentTarget ? Number(appointmentTarget) : null,
          notes:             notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar meta");
      setGoal({
        id:               data.goal.id,
        revenueTarget:    data.goal.revenueTarget     ? Number(data.goal.revenueTarget)  : null,
        appointmentTarget: data.goal.appointmentTarget ?? null,
        notes:             data.goal.notes ?? null,
      });
      toast({ title: "Meta salva!" });
    } catch (e) {
      toast({ title: "Erro", description: String(e), variant: "destructive" });
    } finally {
      setSavingGoal(false);
    }
  }

  // Derived
  const revenueProgress = goal?.revenueTarget ? Math.min(revenueThisMonth / goal.revenueTarget, 1) : null;
  const apptProgress    = goal?.appointmentTarget ? Math.min(completedThis / goal.appointmentTarget, 1) : null;
  const revenueDelta    = revenuePrevMonth > 0 ? (revenueThisMonth - revenuePrevMonth) / revenuePrevMonth : null;
  const completedDelta  = completedPrev  > 0 ? (completedThis  - completedPrev)  / completedPrev  : null;
  const ticketDelta     = avgTicketPrev  > 0 ? (avgTicket      - avgTicketPrev)  / avgTicketPrev  : null;
  const maxRevenue      = Math.max(...byService.map((s) => s.revenue), 1);

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex rounded-lg border border-border overflow-hidden w-fit">
        {([
          ["overview", "Visão Geral",  BarChart3],
          ["goals",    "Metas",        Target],
          ["services", "Por Serviço",  Scissors],
        ] as [Tab, string, React.ElementType][]).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-r border-border last:border-r-0 transition-colors
              ${tab === key ? "bg-gold-500/15 text-gold-400" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* ── Visão Geral ────────────────────────────────── */}
      {tab === "overview" && (
        <div className="space-y-5">
          {/* KPI Cards */}
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
              progress={apptProgress}
              progressLabel={goal?.appointmentTarget ? `Meta: ${goal.appointmentTarget}` : undefined}
            />
            <KpiCard
              label="Ticket médio"
              value={formatBRL(avgTicket)}
              delta={ticketDelta}
              sub={`Mês anterior: ${formatBRL(avgTicketPrev)}`}
            />
          </div>

          {/* Secondary stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-1">Total de agendamentos (não cancelados)</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">{totalAppointmentsThis}</p>
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
              <p className="text-xs text-muted-foreground mb-1">Taxa de conversão (concluídos / agendados)</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">
                {totalAppointmentsThis > 0 ? `${Math.round(completedThis / totalAppointmentsThis * 100)}%` : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {completedThis} de {totalAppointmentsThis} atendimentos
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Metas ──────────────────────────────────────── */}
      {tab === "goals" && (
        <div className="max-w-lg space-y-5">
          <p className="text-sm text-muted-foreground">
            Defina as metas para <span className="capitalize text-foreground font-medium">{monthLabel}</span>.
            Elas aparecem no dashboard e são usadas pela IA para sugestões contextuais.
          </p>

          {/* Current progress if goal exists */}
          {goal && (
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <p className="text-xs font-medium text-foreground uppercase tracking-wide">Progresso atual</p>
              {goal.revenueTarget && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Receita</span>
                    <span className="text-foreground font-medium">
                      {formatBRL(revenueThisMonth)} / {formatBRL(goal.revenueTarget)}
                      {" "}({Math.round(Math.min(revenueThisMonth / goal.revenueTarget, 1) * 100)}%)
                    </span>
                  </div>
                  <ProgressBar value={Math.min(revenueThisMonth / goal.revenueTarget, 1)} />
                </div>
              )}
              {goal.appointmentTarget && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Atendimentos</span>
                    <span className="text-foreground font-medium">
                      {completedThis} / {goal.appointmentTarget}
                      {" "}({Math.round(Math.min(completedThis / goal.appointmentTarget, 1) * 100)}%)
                    </span>
                  </div>
                  <ProgressBar value={Math.min(completedThis / goal.appointmentTarget, 1)} />
                </div>
              )}
            </div>
          )}

          {/* Edit form */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            <p className="text-xs font-medium text-foreground uppercase tracking-wide">
              {goal ? "Editar meta" : "Definir meta"}
            </p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Meta de receita (R$)</label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={revenueTarget}
                  onChange={(e) => setRevenueTarget(e.target.value)}
                  placeholder="Ex: 15000"
                  className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Meta de atendimentos</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={appointmentTarget}
                  onChange={(e) => setAppointmentTarget(e.target.value)}
                  placeholder="Ex: 120"
                  className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Observações</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Contexto, promoções planejadas, etc."
                  className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
              </div>
            </div>
            <Button onClick={handleSaveGoal} disabled={savingGoal}>
              {savingGoal ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar meta"}
            </Button>
          </div>
        </div>
      )}

      {/* ── Por Serviço ────────────────────────────────── */}
      {tab === "services" && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {byService.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              Nenhum atendimento concluído este mês ainda.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-800/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Serviço</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Categoria</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Qtd</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Ticket médio</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Receita</th>
                  <th className="px-4 py-3 w-32"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {byService.map((s) => (
                  <tr key={s.name} className="hover:bg-surface-800/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{s.name}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-[10px]">{CATEGORY_LABEL[s.category] ?? s.category}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">{s.count}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatBRL(s.revenue / s.count)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-gold-400">{formatBRL(s.revenue)}</td>
                    <td className="px-4 py-3">
                      {/* CSS bar proportional to max */}
                      <div className="h-1.5 rounded-full bg-surface-700 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gold-500"
                          style={{ width: `${(s.revenue / maxRevenue) * 100}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-surface-800/30">
                  <td className="px-4 py-3 text-xs font-semibold text-foreground" colSpan={2}>Total</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-foreground">
                    {byService.reduce((s, r) => s + r.count, 0)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-muted-foreground">
                    {completedThis > 0 ? formatBRL(revenueThisMonth / completedThis) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-gold-400">
                    {formatBRL(revenueThisMonth)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────

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
