"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/utils";
import {
  Target, CheckCircle2, Loader2, Sparkles, X as XIcon,
  Calendar, TrendingUp, ChevronLeft, ChevronRight, Sun,
  Plus, Pencil,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getDaysInMonth } from "date-fns";

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

interface AnnualMonth {
  month: number; label: string; revenue: number; count: number; goal: number | null;
}

interface GoalRow {
  id: string; month: number; year: number; monthLabel: string;
  revenueTarget: number | null; revenueActual: number;
  isPast: boolean; isCurrent: boolean;
  offDaysOfWeek:    number[];
  extraOffDays:     number[];
  extraWorkDays:    number[];
  workingDaysCount: number | null;
}

interface Props {
  month: number;
  year:  number;
  monthLabel: string;
  goal: Goal | null;
  revenueThisMonth: number;
  todayRevenue: number;
  isOffDay: boolean;
  revenueByDay:   Record<number, number>;
  scheduledByDay: Record<number, number>;
  allGoals: GoalRow[];
  annualMonths: AnnualMonth[];
}

// ── Constants ─────────────────────────────────────────────────

const DOW_LABELS = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const DOW_FULL   = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

// ── Helpers ───────────────────────────────────────────────────

function countWorkingDays(month: number, year: number, offDaysOfWeek: number[], extraOffDays: number[], extraWorkDays: number[]) {
  const total = getDaysInMonth(new Date(year, month - 1, 1));
  let count = 0;
  for (let d = 1; d <= total; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if ((!offDaysOfWeek.includes(dow) || extraWorkDays.includes(d)) && !extraOffDays.includes(d)) count++;
  }
  return count;
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

// ── Days calendar ─────────────────────────────────────────────

function DaysCalendar({
  month, year, offDaysOfWeek, extraOffDays = [], extraWorkDays = [],
  setExtraOffDays, setExtraWorkDays,
  revenueByDay, scheduledByDay, dailyGoal, today, readOnly = false,
}: {
  month: number; year: number;
  offDaysOfWeek: number[]; extraOffDays?: number[]; extraWorkDays?: number[];
  setExtraOffDays?: (v: number[]) => void; setExtraWorkDays?: (v: number[]) => void;
  revenueByDay?: Record<number, number>; scheduledByDay?: Record<number, number>;
  dailyGoal?: number | null; today?: number; readOnly?: boolean;
}) {
  const daysInMonth = getDaysInMonth(new Date(year, month - 1, 1));
  const firstDow    = new Date(year, month - 1, 1).getDay();
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  function isWorking(day: number) {
    const dow = new Date(year, month - 1, day).getDay();
    return (!offDaysOfWeek.includes(dow) || extraWorkDays.includes(day)) && !extraOffDays.includes(day);
  }

  function handleClick(day: number) {
    if (readOnly || !setExtraOffDays || !setExtraWorkDays) return;
    const dow = new Date(year, month - 1, day).getDay();
    if (extraOffDays.includes(day)) setExtraOffDays(extraOffDays.filter((d) => d !== day));
    else if (extraWorkDays.includes(day)) setExtraWorkDays(extraWorkDays.filter((d) => d !== day));
    else if (offDaysOfWeek.includes(dow)) setExtraWorkDays([...extraWorkDays, day]);
    else setExtraOffDays([...extraOffDays, day]);
  }

  function getDayStyle(day: number): string {
    const working = isWorking(day);
    const isToday = today === day;
    const ring = isToday ? " ring-1 ring-gold-400" : "";
    if (!working) return `bg-zinc-800/60 text-zinc-600 border border-zinc-700/40${ring}`;
    if (revenueByDay && today !== undefined) {
      const isPast = day < today!;
      if (isPast || isToday) {
        const rev = revenueByDay[day] ?? 0;
        const goal = dailyGoal ?? 0;
        if (goal > 0 && rev >= goal) return `bg-emerald-500/20 text-emerald-300 border border-emerald-500/30${ring}`;
        if (rev > 0 || isToday) return `bg-red-500/15 text-red-300 border border-red-500/25${ring}`;
        return `bg-red-500/10 text-red-400/70 border border-red-500/15${ring}`;
      }
      const scheduled = scheduledByDay?.[day] ?? 0;
      if (scheduled > 0) return `bg-amber-500/15 text-amber-300 border border-amber-500/25${ring}`;
    }
    if (extraWorkDays.includes(day)) return `bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 border-dashed${ring}`;
    return `bg-zinc-700/40 text-foreground/70 hover:bg-zinc-600/50${ring}`;
  }

  return (
    <div className="mt-2">
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DOW_LABELS.map((d) => (
          <div key={d} className="text-center text-[9px] font-semibold text-muted-foreground uppercase tracking-wide py-0.5">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const working = isWorking(day);
          return (
            <button key={i} type="button" disabled={readOnly}
              onClick={() => handleClick(day)}
              className={`flex items-center justify-center rounded text-[10px] h-6 font-medium transition-colors ${getDayStyle(day)} ${!readOnly ? "cursor-pointer" : "cursor-default"}`}
            >
              {!working && !extraWorkDays.includes(day) ? <XIcon className="h-2.5 w-2.5" /> : day}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
        {revenueByDay ? (
          <>
            <span className="flex items-center gap-1 text-[9px] text-emerald-400"><span className="h-2 w-2 rounded-sm bg-emerald-500/20 border border-emerald-500/30 inline-block" />Meta atingida</span>
            <span className="flex items-center gap-1 text-[9px] text-red-400"><span className="h-2 w-2 rounded-sm bg-red-500/15 border border-red-500/25 inline-block" />Abaixo</span>
            <span className="flex items-center gap-1 text-[9px] text-amber-300"><span className="h-2 w-2 rounded-sm bg-amber-500/15 border border-amber-500/25 inline-block" />Agendado</span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1 text-[9px] text-zinc-500"><XIcon className="h-2 w-2 text-zinc-600 inline" />Folga</span>
            {!readOnly && <span className="text-[9px] text-muted-foreground">Clique para ajustar dias</span>}
          </>
        )}
      </div>
    </div>
  );
}

// ── Off-days picker (shared between create and edit) ──────────

function OffDaysPicker({ offDaysOfWeek, setOffDaysOfWeek }: { offDaysOfWeek: number[]; setOffDaysOfWeek: (v: number[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {DOW_LABELS.map((label, dow) => (
        <button key={dow} type="button"
          onClick={() => setOffDaysOfWeek(offDaysOfWeek.includes(dow) ? offDaysOfWeek.filter((d) => d !== dow) : [...offDaysOfWeek, dow])}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
            offDaysOfWeek.includes(dow)
              ? "bg-red-500/15 border-red-500/40 text-red-400"
              : "bg-surface-800 border-border text-muted-foreground hover:text-foreground"
          }`}
        >{label}</button>
      ))}
    </div>
  );
}

// ── AI Wizard ─────────────────────────────────────────────────

type WizardStep = "idle" | "days" | "hours" | "context" | "suggesting" | "review";
type AiResult = { suggestedRevenueTarget: number; workingDaysCount: number; explanation: string };

function AiWizard({
  targetMonth, targetYear,
  onAccept, onClose,
}: {
  targetMonth: number; targetYear: number;
  onAccept: (result: AiResult, offDays: number[]) => void;
  onClose: () => void;
}) {
  const [step,          setStep]          = useState<WizardStep>("days");
  const [wizardOffDays, setWizardOffDays] = useState<number[]>([]);
  const [hours,         setHours]         = useState("8");
  const [apptsPerHour,  setApptsPerHour]  = useState("2");
  const [context,       setContext]       = useState("");
  const [suggestion,    setSuggestion]    = useState<AiResult | null>(null);

  async function suggest() {
    setStep("suggesting");
    try {
      const res = await fetch("/api/goals/ai-suggest", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: targetMonth, year: targetYear,
          offDaysOfWeek:       wizardOffDays,
          hoursPerDay:         Number(hours),
          appointmentsPerHour: Number(apptsPerHour),
          wizardContext:       context.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro");
      window.dispatchEvent(new Event("ai-used"));
      setSuggestion(data);
      setStep("review");
    } catch (e) {
      toast({ title: "Erro na IA", description: String(e), variant: "destructive" });
      setStep("hours");
    }
  }

  return (
    <div className="rounded-lg border border-gold-500/30 bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-gold-400" />
          <p className="text-sm font-semibold text-foreground">Assistente de metas — {MONTH_NAMES[targetMonth - 1]} {targetYear}</p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><XIcon className="h-4 w-4" /></button>
      </div>

      {step === "days" && (
        <>
          <p className="text-sm text-foreground">Quais dias você <span className="font-semibold text-red-400">não vai trabalhar</span>?</p>
          <div className="flex flex-wrap gap-2">
            {DOW_FULL.map((label, dow) => (
              <button key={dow} type="button" onClick={() => setWizardOffDays((p) => p.includes(dow) ? p.filter((d) => d !== dow) : [...p, dow])}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${wizardOffDays.includes(dow) ? "bg-red-500/15 border-red-500/40 text-red-400" : "bg-surface-800 border-border text-muted-foreground hover:text-foreground"}`}
              >{label}</button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">{wizardOffDays.length === 0 ? "Nenhuma folga selecionada" : `Folgas: ${wizardOffDays.map((d) => DOW_FULL[d]).join(", ")}`}</p>
          <Button size="sm" onClick={() => setStep("hours")}>Próximo →</Button>
        </>
      )}

      {step === "hours" && (
        <>
          <p className="text-sm text-foreground">Qual sua capacidade de atendimento?</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Horas por dia</label>
              <input type="number" min="1" max="16" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)}
                className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Atendimentos/hora</label>
              <input type="number" min="1" max="10" value={apptsPerHour} onChange={(e) => setApptsPerHour(e.target.value)}
                className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setStep("days")}>← Voltar</Button>
            <Button size="sm" onClick={() => setStep("context")} disabled={!hours || !apptsPerHour}>Próximo →</Button>
          </div>
        </>
      )}

      {step === "context" && (
        <>
          <p className="text-sm text-foreground">Algo especial neste mês? <span className="text-muted-foreground text-xs">(opcional)</span></p>
          <textarea value={context} onChange={(e) => setContext(e.target.value)} rows={3}
            placeholder="Ex: feriado dia 15, vou trabalhar no sábado dia 12..."
            className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setStep("hours")}>← Voltar</Button>
            <Button size="sm" onClick={suggest}>Gerar sugestão com IA</Button>
          </div>
        </>
      )}

      {step === "suggesting" && (
        <div className="flex flex-col items-center gap-3 py-4">
          <Loader2 className="h-6 w-6 animate-spin text-gold-400" />
          <p className="text-sm text-muted-foreground">A IA está calculando sua meta ideal...</p>
        </div>
      )}

      {step === "review" && suggestion && (
        <>
          <div className="rounded-lg border border-green-500/30 bg-green-500/8 p-4 space-y-2">
            <p className="text-xs font-semibold text-green-400 uppercase tracking-wide">Sugestão da IA</p>
            <p className="text-2xl font-bold text-foreground tabular-nums">{formatBRL(suggestion.suggestedRevenueTarget)}</p>
            <p className="text-xs text-muted-foreground">{suggestion.explanation}</p>
            <p className="text-[11px] text-muted-foreground">
              <Calendar className="h-3 w-3 inline mr-1" />
              {suggestion.workingDaysCount} dias úteis · Meta diária: {formatBRL(suggestion.suggestedRevenueTarget / suggestion.workingDaysCount)}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setStep("hours")}>← Ajustar</Button>
            <Button size="sm" onClick={() => onAccept(suggestion, wizardOffDays)}>Usar essa meta</Button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Goal form (create + edit shared) ─────────────────────────

function GoalForm({
  month, year,
  initial,
  revenueByDay, scheduledByDay,
  isCurrent,
  revenueThisMonth,
  onSave,
  onCancel,
  showAiWizard,
}: {
  month: number; year: number;
  initial: { revenueTarget: string; offDaysOfWeek: number[]; extraOffDays: number[]; extraWorkDays: number[] };
  revenueByDay?:   Record<number, number>;
  scheduledByDay?: Record<number, number>;
  isCurrent?: boolean;
  revenueThisMonth?: number;
  onSave: (result: { revenueTarget: string; offDaysOfWeek: number[]; extraOffDays: number[]; extraWorkDays: number[] }) => Promise<void>;
  onCancel: () => void;
  showAiWizard?: boolean;
}) {
  const [revenueTarget, setRevenueTarget] = useState(initial.revenueTarget);
  const [offDaysOfWeek, setOffDaysOfWeek] = useState(initial.offDaysOfWeek);
  const [extraOffDays,  setExtraOffDays]  = useState(initial.extraOffDays);
  const [extraWorkDays, setExtraWorkDays] = useState(initial.extraWorkDays);
  const [saving,        setSaving]        = useState(false);
  const [showWizard,    setShowWizard]    = useState(false);

  const workDays    = countWorkingDays(month, year, offDaysOfWeek, extraOffDays, extraWorkDays);
  const dailyTarget = revenueTarget && workDays > 0 ? Number(revenueTarget) / workDays : null;
  const today       = isCurrent ? new Date().getDate() : undefined;

  function acceptAi(result: AiResult, offDays: number[]) {
    setRevenueTarget(String(result.suggestedRevenueTarget));
    setOffDaysOfWeek(offDays);
    setExtraOffDays([]);
    setExtraWorkDays([]);
    setShowWizard(false);
  }

  async function save() {
    setSaving(true);
    try {
      await onSave({ revenueTarget, offDaysOfWeek, extraOffDays, extraWorkDays });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* AI wizard */}
      {showAiWizard && !showWizard && (
        <button
          onClick={() => setShowWizard(true)}
          className="w-full flex items-center gap-3 rounded-lg border border-gold-500/30 bg-gold-500/8 px-4 py-3 text-left hover:bg-gold-500/15 transition-colors"
        >
          <Sparkles className="h-4 w-4 text-gold-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gold-400">Criar meta com IA</p>
            <p className="text-xs text-muted-foreground">Responda 3 perguntas e a IA sugere sua meta</p>
          </div>
        </button>
      )}

      {showWizard && (
        <AiWizard
          targetMonth={month} targetYear={year}
          onAccept={acceptAi}
          onClose={() => setShowWizard(false)}
        />
      )}

      {/* Off days */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-foreground">Dias de folga na semana</label>
        <OffDaysPicker offDaysOfWeek={offDaysOfWeek} setOffDaysOfWeek={setOffDaysOfWeek} />
        <p className="text-[11px] text-muted-foreground">
          Dias úteis: <span className="font-semibold text-foreground">{workDays}</span>
          {(extraOffDays.length > 0 || extraWorkDays.length > 0) && (
            <span className="ml-2 text-[10px] text-gold-400">({extraOffDays.length} bloqueado{extraOffDays.length !== 1 ? "s" : ""}, {extraWorkDays.length} extra{extraWorkDays.length !== 1 ? "s" : ""})</span>
          )}
        </p>
        <DaysCalendar
          month={month} year={year}
          offDaysOfWeek={offDaysOfWeek}
          extraOffDays={extraOffDays}   setExtraOffDays={setExtraOffDays}
          extraWorkDays={extraWorkDays} setExtraWorkDays={setExtraWorkDays}
          revenueByDay={isCurrent ? revenueByDay : undefined}
          scheduledByDay={isCurrent ? scheduledByDay : undefined}
          dailyGoal={dailyTarget}
          today={today}
        />
      </div>

      {/* Revenue target */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">Meta de receita (R$)</label>
        <input
          type="number" min="0" step="100"
          value={revenueTarget}
          onChange={(e) => setRevenueTarget(e.target.value)}
          placeholder="Ex: 15000"
          className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {dailyTarget && (
          <p className="text-[11px] text-muted-foreground">
            Meta diária: <span className="font-semibold text-gold-400">{formatBRL(dailyTarget)}</span>
          </p>
        )}
      </div>

      {/* Current month progress */}
      {isCurrent && revenueThisMonth !== undefined && revenueTarget && Number(revenueTarget) > 0 && (
        <div className="space-y-1 pt-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progresso atual</span>
            <span>{formatBRL(revenueThisMonth)} / {formatBRL(Number(revenueTarget))} ({Math.round(Math.min(revenueThisMonth / Number(revenueTarget), 1) * 100)}%)</span>
          </div>
          <ProgressBar value={Math.min(revenueThisMonth / Number(revenueTarget), 1)} />
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>Cancelar</Button>
        <Button size="sm" onClick={save} disabled={saving || !revenueTarget}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
          Salvar meta
        </Button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

export function MetaClient({
  month, year, monthLabel,
  goal: initialGoal,
  revenueThisMonth,
  todayRevenue,
  isOffDay: initialIsOffDay,
  revenueByDay,
  scheduledByDay,
  allGoals: initialAllGoals,
  annualMonths: initialAnnualMonths,
}: Props) {
  const [goal,    setGoal]    = useState<Goal | null>(initialGoal);
  const [offDay,  setOffDay]  = useState(initialIsOffDay);
  const [unlocking, setUnlocking] = useState(false);
  const [allGoals, setAllGoals]   = useState<GoalRow[]>(initialAllGoals);

  // Create state
  const [creating,      setCreating]      = useState(false);
  const [createMonthYear, setCreateMonthYear] = useState<{month: number; year: number} | null>(null);

  // Edit state (by goal id)
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);

  // Annual chart
  const [annualYear,  setAnnualYear]  = useState(year);
  const [annualData,  setAnnualData]  = useState(initialAnnualMonths);
  const [loadingYear, setLoadingYear] = useState(false);
  const [showAnnual,  setShowAnnual]  = useState(false);

  // ── Derived ──────────────────────────────────────────────

  const today = new Date().getDate();
  const workingDaysCount = goal?.workingDaysCount ?? null;
  const dailyGoal        = goal?.revenueTarget && workingDaysCount && workingDaysCount > 0
    ? goal.revenueTarget / workingDaysCount : null;
  const monthProgress    = goal?.revenueTarget ? Math.min(revenueThisMonth / goal.revenueTarget, 1) : null;
  const dayProgress      = dailyGoal ? Math.min(todayRevenue / dailyGoal, 1) : null;
  const maxAnnual        = Math.max(...annualData.map((m) => Math.max(m.revenue, m.goal ?? 0)), 1);

  // Available months for NEW goal: up to 12 months ahead, excluding months that already have goals
  const existingMonthYears = new Set(allGoals.map((g) => `${g.year}-${g.month}`));
  const availableForCreate = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(year, month - 1 + i, 1);
    return { month: d.getMonth() + 1, year: d.getFullYear() };
  }).filter(({ month: m, year: y }) => !existingMonthYears.has(`${y}-${m}`));

  // ── Actions ──────────────────────────────────────────────

  async function handleUnlockOffDay() {
    setUnlocking(true);
    try {
      const res = await fetch("/api/goals/unlock-today", { method: "PATCH" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Erro");
      setOffDay(false);
      toast({ title: "Dia desbloqueado!", description: "Bora faturar!" });
    } catch (e) {
      toast({ title: "Erro", description: String(e), variant: "destructive" });
    } finally {
      setUnlocking(false);
    }
  }

  async function saveGoal(
    targetMonth: number, targetYear: number,
    { revenueTarget, offDaysOfWeek, extraOffDays, extraWorkDays }: { revenueTarget: string; offDaysOfWeek: number[]; extraOffDays: number[]; extraWorkDays: number[] },
    existingId?: string,
  ) {
    const res = await fetch("/api/goals", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: targetMonth, year: targetYear, revenueTarget: revenueTarget ? Number(revenueTarget) : null, offDaysOfWeek, extraOffDays, extraWorkDays }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Erro ao salvar meta");

    const saved: GoalRow = {
      id:               data.goal.id,
      month:            targetMonth,
      year:             targetYear,
      monthLabel:       MONTH_NAMES[targetMonth - 1].slice(0, 3),
      revenueTarget:    data.goal.revenueTarget ? Number(data.goal.revenueTarget) : null,
      revenueActual:    allGoals.find((g) => g.month === targetMonth && g.year === targetYear)?.revenueActual ?? 0,
      isPast:           targetYear < year || (targetYear === year && targetMonth < month),
      isCurrent:        targetMonth === month && targetYear === year,
      offDaysOfWeek,
      extraOffDays,
      extraWorkDays,
      workingDaysCount: data.goal.workingDaysCount ?? null,
    };

    setAllGoals((prev) => {
      const idx = prev.findIndex((g) => g.month === targetMonth && g.year === targetYear);
      return idx >= 0
        ? prev.map((g, i) => i === idx ? saved : g)
        : [...prev, saved].sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
    });

    if (saved.isCurrent) {
      setGoal({ id: saved.id, revenueTarget: saved.revenueTarget, appointmentTarget: null, notes: null, offDaysOfWeek, extraOffDays, extraWorkDays, workingDaysCount: data.goal.workingDaysCount ?? null });
    }

    toast({ title: `Meta de ${MONTH_NAMES[targetMonth - 1]} ${targetYear} salva!` });
  }

  async function handleCreateSave(form: { revenueTarget: string; offDaysOfWeek: number[]; extraOffDays: number[]; extraWorkDays: number[] }) {
    if (!createMonthYear) return;
    await saveGoal(createMonthYear.month, createMonthYear.year, form);
    setCreating(false);
    setCreateMonthYear(null);
  }

  async function handleEditSave(g: GoalRow, form: { revenueTarget: string; offDaysOfWeek: number[]; extraOffDays: number[]; extraWorkDays: number[] }) {
    await saveGoal(g.month, g.year, form, g.id);
    setEditingGoalId(null);
  }

  async function loadYear(y: number) {
    setLoadingYear(true);
    try {
      const res = await fetch(`/api/financeiro/annual?year=${y}`);
      const data = await res.json();
      setAnnualYear(y);
      setAnnualData(data.months);
    } finally { setLoadingYear(false); }
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* KPI Cards / Off-day banner */}
      {offDay ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/8 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Sun className="h-6 w-6 text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-400">Hoje é sua folga</p>
              <p className="text-xs text-muted-foreground">Você programou este dia como descanso.</p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="border-amber-500/40 text-amber-400 hover:bg-amber-500/15 shrink-0"
            onClick={handleUnlockOffDay} disabled={unlocking}>
            {unlocking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Me enganei, vou trabalhar"}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="rounded-lg border border-border bg-card p-3 sm:p-4 space-y-2">
            <p className="text-xs text-muted-foreground">Faturamento hoje</p>
            <div className="flex items-end gap-2 flex-wrap">
              <p className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">{formatBRL(todayRevenue)}</p>
              {dailyGoal && <span className="text-xs text-muted-foreground mb-0.5">/ {formatBRL(dailyGoal)}</span>}
            </div>
            {dayProgress != null ? (
              <div className="space-y-1">
                <ProgressBar value={dayProgress} />
                <p className="text-[10px] text-muted-foreground">{Math.round(dayProgress * 100)}% da meta diária</p>
              </div>
            ) : <p className="text-[10px] text-muted-foreground">Sem meta diária</p>}
          </div>
          <div className="rounded-lg border border-border bg-card p-3 sm:p-4 space-y-2">
            <p className="text-xs text-muted-foreground">Faturamento em {monthLabel}</p>
            <div className="flex items-end gap-2 flex-wrap">
              <p className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">{formatBRL(revenueThisMonth)}</p>
              {goal?.revenueTarget && <span className="text-xs text-muted-foreground mb-0.5">/ {formatBRL(goal.revenueTarget)}</span>}
            </div>
            {monthProgress != null ? (
              <div className="space-y-1">
                <ProgressBar value={monthProgress} />
                <p className="text-[10px] text-muted-foreground">{Math.round(monthProgress * 100)}% da meta mensal</p>
              </div>
            ) : <p className="text-[10px] text-muted-foreground">Sem meta mensal</p>}
          </div>
        </div>
      )}

      {/* ── Create new goal section ───────────────────────── */}
      {!creating && availableForCreate.length > 0 && (
        <button
          onClick={() => setCreating(true)}
          className="w-full flex items-center gap-3 rounded-lg border border-dashed border-border hover:border-gold-500/40 hover:bg-gold-500/5 px-4 py-3 text-left transition-colors group"
        >
          <Plus className="h-4 w-4 text-muted-foreground group-hover:text-gold-400 transition-colors shrink-0" />
          <div>
            <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">Nova meta</p>
            <p className="text-xs text-muted-foreground">{availableForCreate.length} mês{availableForCreate.length !== 1 ? "es" : ""} disponíve{availableForCreate.length !== 1 ? "is" : "l"}</p>
          </div>
        </button>
      )}

      {creating && (
        <div className="rounded-xl border border-gold-500/30 bg-card p-4 sm:p-5 space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Nova meta</p>
            <button onClick={() => { setCreating(false); setCreateMonthYear(null); }} className="text-muted-foreground hover:text-foreground">
              <XIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Step 1: Choose month */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Escolha o mês</label>
            <select
              value={createMonthYear ? `${createMonthYear.year}-${createMonthYear.month}` : ""}
              onChange={(e) => {
                if (!e.target.value) { setCreateMonthYear(null); return; }
                const [y, m] = e.target.value.split("-").map(Number);
                setCreateMonthYear({ month: m, year: y });
              }}
              className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Selecione um mês...</option>
              {availableForCreate.map(({ month: m, year: y }) => (
                <option key={`${y}-${m}`} value={`${y}-${m}`}>
                  {MONTH_NAMES[m - 1]} {y}{m === month && y === year ? " (mês atual)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Step 2: Form (only shown after month is selected) */}
          {createMonthYear && (
            <GoalForm
              month={createMonthYear.month}
              year={createMonthYear.year}
              initial={{ revenueTarget: "", offDaysOfWeek: [], extraOffDays: [], extraWorkDays: [] }}
              revenueByDay={createMonthYear.month === month && createMonthYear.year === year ? revenueByDay : undefined}
              scheduledByDay={createMonthYear.month === month && createMonthYear.year === year ? scheduledByDay : undefined}
              isCurrent={createMonthYear.month === month && createMonthYear.year === year}
              revenueThisMonth={revenueThisMonth}
              onSave={handleCreateSave}
              onCancel={() => { setCreating(false); setCreateMonthYear(null); }}
              showAiWizard
            />
          )}
        </div>
      )}

      {/* ── Goals list ────────────────────────────────────── */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Metas definidas</p>

        {allGoals.length === 0 ? (
          <div className="rounded-lg border border-border p-6 text-center">
            <Target className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma meta definida ainda.</p>
          </div>
        ) : (
          allGoals.map((g) => {
            const pct      = g.revenueTarget ? Math.min(g.revenueActual / g.revenueTarget, 1) : null;
            const workDays = g.workingDaysCount ?? countWorkingDays(g.month, g.year, g.offDaysOfWeek, g.extraOffDays, g.extraWorkDays);
            const dGoal    = g.revenueTarget && workDays > 0 ? g.revenueTarget / workDays : null;
            const isEditing = editingGoalId === g.id;

            return (
              <div key={g.id} className={`rounded-xl border p-3 sm:p-4 space-y-3 transition-colors ${g.isCurrent ? "border-gold-500/30 bg-gold-500/5" : "border-border bg-card"}`}>
                {/* Goal header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">{MONTH_NAMES[g.month - 1]} {g.year !== year ? g.year : ""}</span>
                    {g.isCurrent && <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-gold-400 border-gold-500/30">Atual</Badge>}
                    {workDays > 0 && (
                      <span className="text-[10px] text-muted-foreground border border-border rounded-full px-1.5 py-0.5">{workDays}d úteis</span>
                    )}
                    {g.isPast && pct !== null && pct >= 1 && <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />}
                  </div>
                  <div className="flex items-center gap-3">
                    {!isEditing && (
                      <div className="text-right">
                        <span className="text-sm font-bold text-gold-400">{g.revenueTarget ? formatBRL(g.revenueTarget) : "—"}</span>
                        {dGoal && <p className="text-[10px] text-muted-foreground">{formatBRL(dGoal)}/dia</p>}
                      </div>
                    )}
                    <button
                      onClick={() => setEditingGoalId(isEditing ? null : g.id)}
                      className={`rounded-md border p-1.5 transition-colors ${isEditing ? "border-gold-500/40 bg-gold-500/10 text-gold-400" : "border-border text-muted-foreground hover:text-foreground hover:bg-surface-800"}`}
                      title={isEditing ? "Cancelar edição" : "Editar meta"}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress (view mode, not editing) */}
                {!isEditing && g.revenueTarget && (g.isPast || g.isCurrent) && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{formatBRL(g.revenueActual)} realizados</span>
                      <span>{Math.round((pct ?? 0) * 100)}%</span>
                    </div>
                    <ProgressBar value={pct ?? 0} />
                  </div>
                )}

                {!isEditing && !g.isPast && !g.isCurrent && g.revenueTarget && (
                  <p className="text-[10px] text-muted-foreground">Meta futura — sem dados ainda</p>
                )}

                {/* Calendar (view mode) */}
                {!isEditing && g.offDaysOfWeek?.length > 0 && (
                  <DaysCalendar
                    month={g.month} year={g.year}
                    offDaysOfWeek={g.offDaysOfWeek}
                    extraOffDays={g.extraOffDays}
                    extraWorkDays={g.extraWorkDays}
                    revenueByDay={g.isCurrent ? revenueByDay : undefined}
                    scheduledByDay={g.isCurrent ? scheduledByDay : undefined}
                    dailyGoal={g.isCurrent && dGoal ? dGoal : null}
                    today={g.isCurrent ? today : undefined}
                    readOnly
                  />
                )}

                {/* Inline edit form */}
                {isEditing && (
                  <GoalForm
                    month={g.month} year={g.year}
                    initial={{
                      revenueTarget: g.revenueTarget ? String(g.revenueTarget) : "",
                      offDaysOfWeek: g.offDaysOfWeek,
                      extraOffDays:  g.extraOffDays,
                      extraWorkDays: g.extraWorkDays,
                    }}
                    revenueByDay={g.isCurrent ? revenueByDay : undefined}
                    scheduledByDay={g.isCurrent ? scheduledByDay : undefined}
                    isCurrent={g.isCurrent}
                    revenueThisMonth={revenueThisMonth}
                    onSave={(form) => handleEditSave(g, form)}
                    onCancel={() => setEditingGoalId(null)}
                    showAiWizard={false}
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Annual chart ──────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <button
          onClick={() => setShowAnnual((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-800/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Histórico anual</span>
          </div>
          <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${showAnnual ? "rotate-90" : ""}`} />
        </button>

        {showAnnual && (
          <div className="border-t border-border p-4 space-y-4">
            <div className="flex items-center gap-3">
              <button onClick={() => loadYear(annualYear - 1)} disabled={loadingYear}
                className="rounded-md border border-border p-1.5 hover:bg-surface-700 disabled:opacity-50">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-base font-bold text-foreground w-16 text-center">{annualYear}</span>
              <button onClick={() => loadYear(annualYear + 1)} disabled={loadingYear || annualYear >= year}
                className="rounded-md border border-border p-1.5 hover:bg-surface-700 disabled:opacity-50">
                <ChevronRight className="h-4 w-4" />
              </button>
              {loadingYear && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <div className="flex items-end gap-2 h-32">
              {annualData.map((m) => {
                const revPct  = (m.revenue / maxAnnual) * 100;
                const goalPct = m.goal ? (m.goal / maxAnnual) * 100 : null;
                const hit     = m.goal && m.revenue >= m.goal;
                const isFuture = annualYear === year && m.month > month;
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex flex-col justify-end h-24 relative">
                      {goalPct !== null && (
                        <div className="absolute w-full border-t-2 border-dashed border-gold-500/50" style={{ bottom: `${goalPct}%` }} />
                      )}
                      <div
                        className={`w-full rounded-sm transition-all ${isFuture ? "bg-surface-700" : hit ? "bg-green-500/70" : m.revenue > 0 ? "bg-gold-500/60" : "bg-surface-700"}`}
                        style={{ height: m.revenue > 0 ? `${Math.max(revPct, 4)}%` : "4px" }}
                        title={`${m.label}: ${formatBRL(m.revenue)}${m.goal ? ` / meta ${formatBRL(m.goal)}` : ""}`}
                      />
                    </div>
                    <span className="text-[9px] text-muted-foreground">{m.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-gold-500/60 inline-block" />Receita</span>
              <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-green-500/70 inline-block" />Meta atingida</span>
              <span className="flex items-center gap-1"><span className="h-0 w-4 border-t-2 border-dashed border-gold-500/50 inline-block" />Meta</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
