"use client";

import { useState, useEffect } from "react";
import { formatBRL, formatPercent } from "@/lib/utils";
import {
  CheckCircle2, XCircle, UserX, TrendingUp, Clock, Calendar,
  Settings2, X, GripVertical,
} from "lucide-react";

export interface AgendaKPIs {
  revenueCompleted: number;
  revenueProjected: number;
  completedCount:   number;
  cancelledCount:   number;
  noShowCount:      number;
  occupancyRate:    number;
  freeSlots:        number;
  totalSlots:       number;
}

// ── Widget registry ───────────────────────────────────────────

const MAX_WIDGETS = 5;
const LS_KEY = "agenda_kpi_widgets";
const DEFAULT_WIDGETS = ["revenue_completed", "completed", "cancelled", "noshow", "occupancy"];

interface WidgetDef {
  key:        string;
  label:      string;
  icon:       (active: boolean) => React.ReactNode;
  value:      (kpis: AgendaKPIs) => string;
  valueClass: (kpis: AgendaKPIs) => string;
  description: string;
}

const WIDGET_DEFS: WidgetDef[] = [
  {
    key:         "revenue_completed",
    label:       "Faturamento realizado",
    icon:        () => <TrendingUp className="h-4 w-4 text-foreground" />,
    value:       (k) => formatBRL(k.revenueCompleted),
    valueClass:  () => "text-foreground",
    description: "Receita dos atendimentos concluídos hoje",
  },
  {
    key:         "revenue_projected",
    label:       "Faturamento previsto",
    icon:        () => <TrendingUp className="h-4 w-4 text-muted-foreground" />,
    value:       (k) => formatBRL(k.revenueProjected),
    valueClass:  () => "text-muted-foreground",
    description: "Receita estimada dos agendamentos futuros de hoje",
  },
  {
    key:         "completed",
    label:       "Concluídos",
    icon:        () => <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
    value:       (k) => String(k.completedCount),
    valueClass:  () => "text-emerald-400",
    description: "Total de atendimentos concluídos hoje",
  },
  {
    key:         "cancelled",
    label:       "Cancelamentos",
    icon:        () => <XCircle className="h-4 w-4 text-red-400" />,
    value:       (k) => String(k.cancelledCount),
    valueClass:  (k) => k.cancelledCount > 0 ? "text-red-400" : "text-foreground",
    description: "Total de agendamentos cancelados no dia",
  },
  {
    key:         "noshow",
    label:       "No-show",
    icon:        () => <UserX className="h-4 w-4 text-orange-400" />,
    value:       (k) => String(k.noShowCount),
    valueClass:  (k) => k.noShowCount > 0 ? "text-orange-400" : "text-foreground",
    description: "Clientes que agendaram mas não compareceram",
  },
  {
    key:         "occupancy",
    label:       "Ocupação",
    icon:        () => <Calendar className="h-4 w-4 text-gold-400" />,
    value:       (k) => formatPercent(k.occupancyRate),
    valueClass:  () => "text-gold-400",
    description: "Percentual de horários ocupados no dia",
  },
  {
    key:         "free_slots",
    label:       "Horários vagos",
    icon:        () => <Clock className="h-4 w-4 text-blue-400" />,
    value:       (k) => `${k.freeSlots} / ${k.totalSlots}`,
    valueClass:  () => "text-blue-400",
    description: "Horários disponíveis em relação ao total do dia",
  },
];

// ── Grid col class based on count ─────────────────────────────

function gridClass(count: number): string {
  switch (count) {
    case 1: return "grid-cols-1";
    case 2: return "grid-cols-2";
    case 3: return "grid-cols-3";
    case 4: return "grid-cols-2 md:grid-cols-4";
    default: return "grid-cols-2 md:grid-cols-3 lg:grid-cols-5";
  }
}

// ── Picker modal ──────────────────────────────────────────────

function WidgetPickerModal({
  current,
  onSave,
  onClose,
}: {
  current:  string[];
  onSave:   (keys: string[]) => void;
  onClose:  () => void;
}) {
  const [selected, setSelected] = useState<string[]>(current);
  const limitReached = selected.length >= MAX_WIDGETS;

  function toggle(key: string) {
    setSelected((prev) =>
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : limitReached
        ? prev
        : [...prev, key]
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-foreground text-sm">Personalizar indicadores</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Escolha até {MAX_WIDGETS} — selecionados: {selected.length}/{MAX_WIDGETS}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1.5 hover:bg-surface-700 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto">
          {WIDGET_DEFS.map((w) => {
            const active = selected.includes(w.key);
            const disabled = !active && limitReached;
            return (
              <button
                key={w.key}
                onClick={() => toggle(w.key)}
                disabled={disabled}
                className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                  active
                    ? "border-gold-500/50 bg-gold-500/10 text-foreground"
                    : disabled
                    ? "border-border/40 bg-surface-900/50 opacity-40 cursor-not-allowed"
                    : "border-border/60 bg-surface-900 hover:border-gold-500/30 hover:bg-surface-800"
                }`}
              >
                <div className="mt-0.5 shrink-0">{w.icon(active)}</div>
                <div className="min-w-0">
                  <p className="text-xs font-medium leading-tight">{w.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{w.description}</p>
                </div>
                {active && (
                  <GripVertical className="h-3.5 w-3.5 text-gold-400 shrink-0 ml-auto" />
                )}
              </button>
            );
          })}
        </div>

        {limitReached && (
          <div className="mx-4 mb-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-400">
            Limite de {MAX_WIDGETS} atingido. Remova um para adicionar outro.
          </div>
        )}

        <div className="flex gap-2 px-4 pb-4 pt-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave(selected)}
            disabled={selected.length === 0}
            className="flex-1 rounded-lg bg-gold-500 py-2 text-sm font-semibold text-black hover:bg-gold-400 transition-colors disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────

function KPICard({
  def, kpis,
}: {
  def:  WidgetDef;
  kpis: AgendaKPIs;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface-900 p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        {def.icon(false)}
        <span className="text-[11px] uppercase tracking-wide leading-tight">{def.label}</span>
      </div>
      <p className={`text-xl font-semibold tabular-nums ${def.valueClass(kpis)}`}>
        {def.value(kpis)}
      </p>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────

export function AgendaKPICards({ kpis }: { kpis: AgendaKPIs }) {
  const [widgetKeys, setWidgetKeys]       = useState<string[]>(DEFAULT_WIDGETS);
  const [showPicker, setShowPicker]       = useState(false);
  const [hydrated,   setHydrated]         = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        const valid  = parsed.filter((k) => WIDGET_DEFS.some((d) => d.key === k));
        if (valid.length > 0) setWidgetKeys(valid.slice(0, MAX_WIDGETS));
      }
    } catch {}
    setHydrated(true);
  }, []);

  function handleSave(keys: string[]) {
    const valid = keys.filter((k) => WIDGET_DEFS.some((d) => d.key === k)).slice(0, MAX_WIDGETS);
    setWidgetKeys(valid);
    try { localStorage.setItem(LS_KEY, JSON.stringify(valid)); } catch {}
    setShowPicker(false);
  }

  const activeDefs = widgetKeys
    .map((key) => WIDGET_DEFS.find((d) => d.key === key))
    .filter(Boolean) as WidgetDef[];

  if (!hydrated) return null; // avoid hydration mismatch

  return (
    <>
      {showPicker && (
        <WidgetPickerModal
          current={widgetKeys}
          onSave={handleSave}
          onClose={() => setShowPicker(false)}
        />
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Indicadores do dia</span>
          <button
            onClick={() => setShowPicker(true)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Personalizar
          </button>
        </div>

        <div className={`grid gap-3 ${gridClass(activeDefs.length)}`}>
          {activeDefs.map((def) => (
            <KPICard key={def.key} def={def} kpis={kpis} />
          ))}
        </div>
      </div>
    </>
  );
}
