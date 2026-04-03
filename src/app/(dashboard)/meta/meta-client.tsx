"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/utils";
import {
  Target, CheckCircle2, Loader2,
  Sparkles, X as XIcon, Calendar,
  TrendingUp, ChevronLeft, ChevronRight,
  Sun,
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
  id: string; month: number; monthLabel: string;
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

// ── Day helpers ───────────────────────────────────────────────

const DOW_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DOW_FULL   = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];

const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

/** Interactive/colored calendar for a month */
function DaysCalendar({
  month, year,
  offDaysOfWeek,
  extraOffDays = [],
  extraWorkDays = [],
  setExtraOffDays,
  setExtraWorkDays,
  revenueByDay,
  scheduledByDay,
  dailyGoal,
  today,
  readOnly = false,
}: {
  month: number; year: number;
  offDaysOfWeek: number[];
  extraOffDays?: number[];
  extraWorkDays?: number[];
  setExtraOffDays?: (v: number[]) => void;
  setExtraWorkDays?: (v: number[]) => void;
  revenueByDay?: Record<number, number>;
  scheduledByDay?: Record<number, number>;
  dailyGoal?: number | null;
  today?: number;
  readOnly?: boolean;
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
    const isOffWeekday = offDaysOfWeek.includes(dow);
    if (extraOffDays.includes(day)) {
      setExtraOffDays(extraOffDays.filter((d) => d !== day));
    } else if (extraWorkDays.includes(day)) {
      setExtraWorkDays(extraWorkDays.filter((d) => d !== day));
    } else if (isOffWeekday) {
      setExtraWorkDays([...extraWorkDays, day]);
    } else {
      setExtraOffDays([...extraOffDays, day]);
    }
  }

  function getDayStyle(day: number): string {
    const working = isWorking(day);
    const isToday = today === day;
    const todayRing = isToday ? " ring-1 ring-gold-400" : "";

    if (!working) return `bg-zinc-800/60 text-zinc-600 border border-zinc-700/40${todayRing}`;

    if (revenueByDay && today !== undefined) {
      const isPast = day < today!;
      if (isPast || isToday) {
        const rev = revenueByDay[day] ?? 0;
        const goal = dailyGoal ?? 0;
        if (goal > 0 && rev >= goal) return `bg-emerald-500/20 text-emerald-300 border border-emerald-500/30${todayRing}`;
        if (rev > 0 || isToday) return `bg-red-500/15 text-red-300 border border-red-500/25${todayRing}`;
        return `bg-red-500/10 text-red-400/70 border border-red-500/15${todayRing}`;
      }
      // future
      const scheduled = scheduledByDay?.[day] ?? 0;
      if (scheduled > 0) return `bg-amber-500/15 text-amber-300 border border-amber-500/25${todayRing}`;
    }

    // override unlocked (was off weekday, now working)
    if (extraWorkDays.includes(day)) return `bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 border-dashed${todayRing}`;
    return `bg-zinc-700/40 text-foreground/70 hover:bg-zinc-600/50${todayRing}`;
  }

  const showLegend = !!revenueByDay;

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
          const style = getDayStyle(day);
          return (
            <button
              key={i}
              type="button"
              disabled={readOnly}
              onClick={() => handleClick(day)}
              title={!readOnly ? (working ? "Clique para bloquear este dia" : "Clique para liberar este dia") : undefined}
              className={`flex items-center justify-center rounded text-[10px] h-6 font-medium transition-colors ${style} ${!readOnly ? "cursor-pointer" : "cursor-default"}`}
            >
              {!working && !extraWorkDays.includes(day) ? <XIcon className="h-2.5 w-2.5" /> : day}
            </button>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
        {showLegend ? (
          <>
            <span className="flex items-center gap-1 text-[9px] text-emerald-400"><span className="h-2 w-2 rounded-sm bg-emerald-500/20 border border-emerald-500/30 inline-block" />Meta atingida</span>
            <span className="flex items-center gap-1 text-[9px] text-red-400"><span className="h-2 w-2 rounded-sm bg-red-500/15 border border-red-500/25 inline-block" />Abaixo da meta</span>
            <span className="flex items-center gap-1 text-[9px] text-amber-300"><span className="h-2 w-2 rounded-sm bg-amber-500/15 border border-amber-500/25 inline-block" />Agenda preenchida</span>
            <span className="flex items-center gap-1 text-[9px] text-zinc-500"><span className="h-2 w-2 rounded-sm bg-zinc-700/40 inline-block" />Dia livre</span>
            <span className="flex items-center gap-1 text-[9px] text-zinc-500"><span className="h-2 w-2 rounded-sm bg-zinc-800/60 border border-zinc-700/40 inline-block" />Folga</span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1 text-[9px] text-zinc-500"><XIcon className="h-2 w-2 text-zinc-600 inline" />Folga</span>
            {!readOnly && <span className="text-[9px] text-muted-foreground">Clique para ajustar dias individuais</span>}
          </>
        )}
      </div>
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
  const [goal, setGoal] = useState<Goal | null>(initialGoal);
  const [offDay, setOffDay] = useState(initialIsOffDay);
  const [unlockingOffDay, setUnlockingOffDay] = useState(false);

  // Goal form state
  const [selectedMonth,  setSelectedMonth]  = useState(month);
  const [revenueTarget,  setRevenueTarget]  = useState(initialGoal?.revenueTarget ? String(initialGoal.revenueTarget) : "");
  const [offDaysOfWeek,  setOffDaysOfWeek]  = useState<number[]>(initialGoal?.offDaysOfWeek ?? []);
  const [extraOffDays,   setExtraOffDays]   = useState<number[]>(initialGoal?.extraOffDays  ?? []);
  const [extraWorkDays,  setExtraWorkDays]  = useState<number[]>(initialGoal?.extraWorkDays ?? []);
  const [savingGoal,     setSavingGoal]     = useState(false);
  const [allGoals,       setAllGoals]       = useState<GoalRow[]>(initialAllGoals);

  // AI wizard state
  type WizardStep = "idle" | "days" | "hours" | "context" | "suggesting" | "review";
  const [wizardStep,         setWizardStep]         = useState<WizardStep>("idle");
  const [wizardOffDays,      setWizardOffDays]      = useState<number[]>([]);
  const [wizardHours,        setWizardHours]        = useState("8");
  const [wizardApptsPerHour, setWizardApptsPerHour] = useState("2");
  const [wizardContext,      setWizardContext]      = useState("");
  const [aiSuggestion,       setAiSuggestion]       = useState<{ suggestedRevenueTarget: number; workingDaysCount: number; explanation: string } | null>(null);

  // Annual chart state
  const [annualYear,  setAnnualYear]  = useState(year);
  const [annualData,  setAnnualData]  = useState(initialAnnualMonths);
  const [loadingYear, setLoadingYear] = useState(false);
  const [showAnnual,  setShowAnnual]  = useState(false);

  // Derived
  const today = new Date().getDate();
  const workingDaysCount = goal?.workingDaysCount ?? null;
  const dailyGoal = goal?.revenueTarget && workingDaysCount && workingDaysCount > 0
    ? goal.revenueTarget / workingDaysCount
    : null;
  const monthProgress = goal?.revenueTarget ? Math.min(revenueThisMonth / goal.revenueTarget, 1) : null;
  const dayProgress   = dailyGoal ? Math.min(todayRevenue / dailyGoal, 1) : null;

  // Available months for goal setting (current through Dec)
  const availableMonths = Array.from({ length: 12 - month + 1 }, (_, i) => month + i);
  const maxAnnual = Math.max(...annualData.map((m) => Math.max(m.revenue, m.goal ?? 0)), 1);

  function toggleWizardDay(dow: number) {
    setWizardOffDays((prev) => prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow]);
  }

  async function handleAiSuggest() {
    setWizardStep("suggesting");
    try {
      const res = await fetch("/api/goals/ai-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: selectedMonth,
          year,
          offDaysOfWeek:       wizardOffDays,
          hoursPerDay:         Number(wizardHours),
          appointmentsPerHour: Number(wizardApptsPerHour),
          wizardContext:       wizardContext.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao gerar sugestão");
      window.dispatchEvent(new Event("ai-used"));
      setAiSuggestion(data);
      setWizardStep("review");
    } catch (e) {
      toast({ title: "Erro na IA", description: String(e), variant: "destructive" });
      setWizardStep("hours");
    }
  }

  function handleAcceptAiSuggestion() {
    if (!aiSuggestion) return;
    setRevenueTarget(String(aiSuggestion.suggestedRevenueTarget));
    setOffDaysOfWeek(wizardOffDays);
    setExtraOffDays([]);
    setExtraWorkDays([]);
    setWizardStep("idle");
    setAiSuggestion(null);
    setWizardContext("");
  }

  async function handleSaveGoal() {
    setSavingGoal(true);
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month:         selectedMonth,
          year,
          revenueTarget: revenueTarget ? Number(revenueTarget) : null,
          offDaysOfWeek,
          extraOffDays,
          extraWorkDays,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar meta");

      const saved: GoalRow = {
        id:               data.goal.id,
        month:            selectedMonth,
        monthLabel:       MONTH_NAMES[selectedMonth - 1].slice(0, 3),
        revenueTarget:    data.goal.revenueTarget ? Number(data.goal.revenueTarget) : null,
        revenueActual:    allGoals.find((g) => g.month === selectedMonth)?.revenueActual ?? 0,
        isPast:           selectedMonth < month,
        isCurrent:        selectedMonth === month,
        offDaysOfWeek:    offDaysOfWeek,
        extraOffDays:     extraOffDays,
        extraWorkDays:    extraWorkDays,
        workingDaysCount: data.goal.workingDaysCount ?? null,
      };

      setAllGoals((prev) => {
        const exists = prev.findIndex((g) => g.month === selectedMonth);
        return exists >= 0
          ? prev.map((g, i) => i === exists ? saved : g)
          : [...prev, saved].sort((a, b) => a.month - b.month);
      });

      if (selectedMonth === month) {
        setGoal({
          id: saved.id,
          revenueTarget: saved.revenueTarget,
          appointmentTarget: null,
          notes: null,
          offDaysOfWeek,
          extraOffDays,
          extraWorkDays,
          workingDaysCount: data.goal.workingDaysCount ?? null,
        });
      }

      toast({ title: `Meta de ${MONTH_NAMES[selectedMonth - 1]} salva!` });
      setRevenueTarget("");
      setOffDaysOfWeek([]);
    } catch (e) {
      toast({ title: "Erro", description: String(e), variant: "destructive" });
    } finally {
      setSavingGoal(false);
    }
  }

  async function handleUnlockOffDay() {
    setUnlockingOffDay(true);
    try {
      const res = await fetch("/api/goals/unlock-today", { method: "PATCH" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erro ao desbloquear dia");
      }
      setOffDay(false);
      toast({ title: "Dia desbloqueado!", description: "Bora faturar!" });
    } catch (e) {
      toast({ title: "Erro", description: String(e), variant: "destructive" });
    } finally {
      setUnlockingOffDay(false);
    }
  }

  async function loadYear(y: number) {
    setLoadingYear(true);
    try {
      const res = await fetch(`/api/financeiro/annual?year=${y}`);
      const data = await res.json();
      setAnnualYear(y);
      setAnnualData(data.months);
    } finally {
      setLoadingYear(false);
    }
  }

  return (
    <div className="space-y-6">

      {/* ── KPI Progress Cards or Off-Day Banner ─────────── */}
      {offDay ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/8 p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Sun className="h-6 w-6 text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-400">Hoje é sua folga</p>
              <p className="text-xs text-muted-foreground">Você programou este dia como descanso. Aproveite!</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-500/40 text-amber-400 hover:bg-amber-500/15 shrink-0"
            onClick={handleUnlockOffDay}
            disabled={unlockingOffDay}
          >
            {unlockingOffDay ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Me enganei, vou trabalhar"}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Hoje */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-2">
            <p className="text-xs text-muted-foreground">Faturamento hoje</p>
            <div className="flex items-end gap-2">
              <p className="text-2xl font-bold text-foreground tabular-nums">{formatBRL(todayRevenue)}</p>
              {dailyGoal && (
                <span className="text-xs text-muted-foreground mb-0.5">/ {formatBRL(dailyGoal)}</span>
              )}
            </div>
            {dayProgress != null ? (
              <div className="space-y-1">
                <ProgressBar value={dayProgress} />
                <p className="text-[10px] text-muted-foreground">{Math.round(dayProgress * 100)}% da meta diária</p>
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground">Sem meta diária definida</p>
            )}
          </div>

          {/* Mês */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-2">
            <p className="text-xs text-muted-foreground">Faturamento em {monthLabel}</p>
            <div className="flex items-end gap-2">
              <p className="text-2xl font-bold text-foreground tabular-nums">{formatBRL(revenueThisMonth)}</p>
              {goal?.revenueTarget && (
                <span className="text-xs text-muted-foreground mb-0.5">/ {formatBRL(goal.revenueTarget)}</span>
              )}
            </div>
            {monthProgress != null ? (
              <div className="space-y-1">
                <ProgressBar value={monthProgress} />
                <p className="text-[10px] text-muted-foreground">{Math.round(monthProgress * 100)}% da meta mensal</p>
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground">Sem meta mensal definida</p>
            )}
          </div>
        </div>
      )}

      {/* ── Goal form + historical list ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: define goal */}
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Defina a meta de receita e os seus dias de trabalho no mês.
          </p>

          {/* AI Wizard */}
          {wizardStep === "idle" && (
            <button
              onClick={() => { setWizardStep("days"); setWizardOffDays(offDaysOfWeek); }}
              className="w-full flex items-center gap-3 rounded-lg border border-gold-500/30 bg-gold-500/8 px-4 py-3 text-left hover:bg-gold-500/15 transition-colors"
            >
              <Sparkles className="h-4 w-4 text-gold-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gold-400">Criar meta com IA</p>
                <p className="text-xs text-muted-foreground">Responda 2 perguntas e a IA sugere sua meta ideal</p>
              </div>
            </button>
          )}

          {(wizardStep === "days" || wizardStep === "hours" || wizardStep === "context" || wizardStep === "suggesting" || wizardStep === "review") && (
            <div className="rounded-lg border border-gold-500/30 bg-card p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-gold-400" />
                  <p className="text-sm font-semibold text-foreground">Assistente de metas</p>
                </div>
                <button onClick={() => { setWizardStep("idle"); setAiSuggestion(null); }} className="text-muted-foreground hover:text-foreground">
                  <XIcon className="h-4 w-4" />
                </button>
              </div>

              {wizardStep === "days" && (
                <>
                  <p className="text-sm text-foreground">Quais dias da semana você <span className="font-semibold text-red-400">não vai trabalhar</span>?</p>
                  <div className="flex flex-wrap gap-2">
                    {DOW_FULL.map((label, dow) => (
                      <button
                        key={dow}
                        type="button"
                        onClick={() => toggleWizardDay(dow)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
                          ${wizardOffDays.includes(dow)
                            ? "bg-red-500/15 border-red-500/40 text-red-400"
                            : "bg-surface-800 border-border text-muted-foreground hover:text-foreground"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {wizardOffDays.length === 0
                      ? "Nenhum dia de folga selecionado"
                      : `Dias de folga: ${wizardOffDays.map((d) => DOW_FULL[d]).join(", ")}`}
                  </p>
                  <Button size="sm" onClick={() => setWizardStep("hours")}>
                    Próximo →
                  </Button>
                </>
              )}

              {wizardStep === "hours" && (
                <>
                  <p className="text-sm text-foreground">Quantas horas por dia você vai trabalhar?</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Horas por dia</label>
                      <input
                        type="number" min="1" max="16" step="0.5"
                        value={wizardHours}
                        onChange={(e) => setWizardHours(e.target.value)}
                        className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Atendimentos por hora</label>
                      <input
                        type="number" min="1" max="10" step="1"
                        value={wizardApptsPerHour}
                        onChange={(e) => setWizardApptsPerHour(e.target.value)}
                        className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setWizardStep("days")}>← Voltar</Button>
                    <Button size="sm" onClick={() => setWizardStep("context")} disabled={!wizardHours || !wizardApptsPerHour}>
                      Próximo →
                    </Button>
                  </div>
                </>
              )}

              {wizardStep === "context" && (
                <>
                  <p className="text-sm text-foreground">Tem algo especial neste mês que a IA deve considerar? <span className="text-muted-foreground text-xs">(opcional)</span></p>
                  <textarea
                    value={wizardContext}
                    onChange={(e) => setWizardContext(e.target.value)}
                    rows={3}
                    placeholder="Ex: feriado na semana do dia 15, vou trabalhar no sábado dia 12, semana de férias a partir do dia 20..."
                    className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setWizardStep("hours")}>← Voltar</Button>
                    <Button size="sm" onClick={handleAiSuggest}>
                      Gerar sugestão com IA
                    </Button>
                  </div>
                </>
              )}

              {wizardStep === "suggesting" && (
                <div className="flex flex-col items-center gap-3 py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-gold-400" />
                  <p className="text-sm text-muted-foreground">A IA está calculando sua meta ideal...</p>
                </div>
              )}

              {wizardStep === "review" && aiSuggestion && (
                <>
                  <div className="rounded-lg border border-green-500/30 bg-green-500/8 p-4 space-y-2">
                    <p className="text-xs font-semibold text-green-400 uppercase tracking-wide">Sugestão da IA</p>
                    <p className="text-2xl font-bold text-foreground tabular-nums">{formatBRL(aiSuggestion.suggestedRevenueTarget)}</p>
                    <p className="text-xs text-muted-foreground">{aiSuggestion.explanation}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      <Calendar className="h-3 w-3 inline mr-1" />
                      {aiSuggestion.workingDaysCount} dias úteis · Meta diária: {formatBRL(aiSuggestion.suggestedRevenueTarget / aiSuggestion.workingDaysCount)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setWizardStep("hours")}>← Ajustar</Button>
                    <Button size="sm" onClick={handleAcceptAiSuggestion}>
                      Usar essa meta
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Manual form */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Mês</label>
              <select
                value={selectedMonth}
                onChange={(e) => {
                  const m = Number(e.target.value);
                  setSelectedMonth(m);
                  const existing = allGoals.find((g) => g.month === m);
                  setRevenueTarget(existing?.revenueTarget ? String(existing.revenueTarget) : "");
                  setOffDaysOfWeek(existing?.offDaysOfWeek ?? []);
                  setExtraOffDays(existing?.extraOffDays  ?? []);
                  setExtraWorkDays(existing?.extraWorkDays ?? []);
                }}
                className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground"
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {MONTH_NAMES[m - 1]} {year}{m === month ? " (atual)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Off days selector */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Dias de folga na semana</label>
              <div className="flex flex-wrap gap-1.5">
                {DOW_LABELS.map((label, dow) => (
                  <button
                    key={dow}
                    type="button"
                    onClick={() => setOffDaysOfWeek((prev) => prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow])}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors
                      ${offDaysOfWeek.includes(dow)
                        ? "bg-red-500/15 border-red-500/40 text-red-400"
                        : "bg-surface-800 border-border text-muted-foreground hover:text-foreground"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {(() => {
                const total = getDaysInMonth(new Date(year, selectedMonth - 1, 1));
                let count = 0;
                for (let d = 1; d <= total; d++) {
                  const dow = new Date(year, selectedMonth - 1, d).getDay();
                  if ((!offDaysOfWeek.includes(dow) || extraWorkDays.includes(d)) && !extraOffDays.includes(d)) count++;
                }
                return (
                  <p className="text-[11px] text-muted-foreground">
                    Dias úteis no mês: <span className="font-semibold text-foreground">{count}</span>
                    {(extraOffDays.length > 0 || extraWorkDays.length > 0) && (
                      <span className="ml-2 text-[10px] text-gold-400">({extraOffDays.length} bloqueado{extraOffDays.length !== 1 ? "s" : ""}, {extraWorkDays.length} extra{extraWorkDays.length !== 1 ? "s" : ""})</span>
                    )}
                  </p>
                );
              })()}
              <DaysCalendar
                month={selectedMonth} year={year}
                offDaysOfWeek={offDaysOfWeek}
                extraOffDays={extraOffDays}   setExtraOffDays={setExtraOffDays}
                extraWorkDays={extraWorkDays} setExtraWorkDays={setExtraWorkDays}
                revenueByDay={selectedMonth === month ? revenueByDay : undefined}
                scheduledByDay={selectedMonth === month ? scheduledByDay : undefined}
                dailyGoal={revenueTarget && offDaysOfWeek.length > 0 ? (() => {
                  const total2 = getDaysInMonth(new Date(year, selectedMonth - 1, 1));
                  let wc = 0;
                  for (let d = 1; d <= total2; d++) {
                    const dow = new Date(year, selectedMonth - 1, d).getDay();
                    if ((!offDaysOfWeek.includes(dow) || extraWorkDays.includes(d)) && !extraOffDays.includes(d)) wc++;
                  }
                  return wc > 0 ? Number(revenueTarget) / wc : null;
                })() : null}
                today={selectedMonth === month ? new Date().getDate() : undefined}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Meta de receita (R$)</label>
              <input
                type="number" min="0" step="100"
                value={revenueTarget}
                onChange={(e) => setRevenueTarget(e.target.value)}
                placeholder="Ex: 15000"
                className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {revenueTarget && offDaysOfWeek.length > 0 && (() => {
                const workDays = Array.from({ length: getDaysInMonth(new Date(year, selectedMonth - 1, 1)) }, (_, i) =>
                  new Date(year, selectedMonth - 1, i + 1).getDay()
                ).filter((d) => !offDaysOfWeek.includes(d)).length;
                return (
                  <p className="text-[11px] text-muted-foreground">
                    Meta diária: <span className="font-semibold text-gold-400">{formatBRL(Number(revenueTarget) / workDays)}</span>
                  </p>
                );
              })()}
            </div>

            {selectedMonth === month && goal?.revenueTarget && (
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progresso atual</span>
                  <span>{formatBRL(revenueThisMonth)} / {formatBRL(goal.revenueTarget)} ({Math.round(Math.min(revenueThisMonth / goal.revenueTarget, 1) * 100)}%)</span>
                </div>
                <ProgressBar value={Math.min(revenueThisMonth / goal.revenueTarget, 1)} />
              </div>
            )}

            <Button onClick={handleSaveGoal} disabled={savingGoal || !revenueTarget}>
              {savingGoal ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar meta"}
            </Button>
          </div>
        </div>

        {/* Right: all defined goals */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Metas definidas — {year}</p>
          {allGoals.length === 0 ? (
            <div className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
              Nenhuma meta definida ainda.
            </div>
          ) : (
            <div className="space-y-2">
              {allGoals.map((g) => {
                const pct       = g.revenueTarget ? Math.min(g.revenueActual / g.revenueTarget, 1) : null;
                const workDays  = g.workingDaysCount ?? 30;
                const dGoal     = g.revenueTarget ? g.revenueTarget / workDays : null;
                return (
                  <div key={g.id} className={`rounded-lg border p-3 space-y-2 ${g.isCurrent ? "border-gold-500/30 bg-gold-500/5" : "border-border"}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">{MONTH_NAMES[g.month - 1]}</span>
                        {g.isCurrent && <Badge variant="outline" className="text-[9px] px-1 py-0">Atual</Badge>}
                        {g.offDaysOfWeek?.length > 0 && (
                          <span className="text-[9px] text-muted-foreground border border-border rounded-full px-1.5 py-0.5">
                            {workDays}d úteis
                          </span>
                        )}
                        {g.isPast && pct !== null && pct >= 1 && <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />}
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-semibold text-gold-400">{g.revenueTarget ? formatBRL(g.revenueTarget) : "—"}</span>
                        {dGoal && <p className="text-[10px] text-muted-foreground">{formatBRL(dGoal)}/dia</p>}
                      </div>
                    </div>
                    {g.revenueTarget && (g.isPast || g.isCurrent) && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>{formatBRL(g.revenueActual)} realizados</span>
                          <span>{Math.round((pct ?? 0) * 100)}%</span>
                        </div>
                        <ProgressBar value={pct ?? 0} />
                      </div>
                    )}
                    {!g.isPast && !g.isCurrent && (
                      <p className="text-[10px] text-muted-foreground">Meta futura — sem dados ainda</p>
                    )}
                    {g.offDaysOfWeek?.length > 0 && (
                      <DaysCalendar
                        month={g.month} year={year}
                        offDaysOfWeek={g.offDaysOfWeek}
                        extraOffDays={g.extraOffDays}
                        extraWorkDays={g.extraWorkDays}
                        revenueByDay={g.isCurrent ? revenueByDay : undefined}
                        scheduledByDay={g.isCurrent ? scheduledByDay : undefined}
                        dailyGoal={g.isCurrent && g.revenueTarget && workDays > 0 ? g.revenueTarget / workDays : null}
                        today={g.isCurrent ? new Date().getDate() : undefined}
                        readOnly
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Annual chart (collapsible) ────────────────────── */}
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
            {/* Year nav */}
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

            {/* Bar chart */}
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
                        <div
                          className="absolute w-full border-t-2 border-dashed border-gold-500/50"
                          style={{ bottom: `${goalPct}%` }}
                        />
                      )}
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
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-gold-500/60 inline-block" /> Receita</span>
              <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-green-500/70 inline-block" /> Meta atingida</span>
              <span className="flex items-center gap-1"><span className="h-0 w-4 border-t-2 border-dashed border-gold-500/50 inline-block" /> Meta</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
