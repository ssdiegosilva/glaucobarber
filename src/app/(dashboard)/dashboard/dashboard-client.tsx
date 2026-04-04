"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBRL, formatTime } from "@/lib/utils";
import {
  Calendar, Clock, TrendingUp, Users, Sparkles,
  CheckCircle2, XCircle, Megaphone, AlertTriangle,
  RefreshCw, ChevronRight, ArrowUpRight, BarChart3,
  Scissors, CreditCard, Plus, Trash2,
  ThumbsUp, Play, Flag, UserX, Ban, CalendarClock as CalendarClockIcon,
  MessageCircle, Zap, ChevronDown, Settings2, Star, MessageSquare,
  UserPlus, Repeat2, Target, X, ExternalLink, Plug, Unplug,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

// ── Types ────────────────────────────────────────────────────

interface Stats {
  totalSlots:        number;
  bookedSlots:       number;
  freeSlots:         number;
  occupancyRate:     number;
  completedRevenue:  number;
  projectedRevenue:  number;
  revenueGoal:       number | null;
  workingDaysCount:  number | null;
  inactiveClients:   number;
}

interface Appointment {
  id:            string;
  customerName:  string;
  serviceName:   string;
  scheduledAt:   string;
  status:        string;
  statusLabel:   string;
  price:         number;
  profissional?: string;
  offerTitle?:   string | null;
}

interface AppointmentItemDto {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface AppointmentDetail {
  appointment: Appointment & {
    price?: number | null;
  };
  items: AppointmentItemDto[];
  payment?: {
    id: string;
    paidValue: number | null;
    discountValue: number | null;
  } | null;
  totals: {
    subtotal: number;
    discount: number;
    total: number;
    paid: number;
    remaining: number;
  };
}

interface PeriodStats {
  totalAppointments: number;
  completedCount:    number;
  completedRevenue:  number;
  avgTicket:         number;
  goalProgress:      number | null;
  dailyRevenue:      { day: string; revenue: number; count: number }[];
}

interface WidgetData {
  avgTicket:       number | null;
  newClients:      number | null;
  returnRate:      number | null;
  weeklyRevenue:   number | null;
  topService:      string | null;
  whatsappQueue:   number | null;
  monthlyGoalPct:  number | null;
}

interface Props {
  view:                  "today" | "week" | "month";
  barbershopName:        string;
  trinksConfigured:      boolean;
  liveError?:            string;
  isOffDay:              boolean;
  stats:                 Stats;
  appointments:          Appointment[];
  periodStats:           PeriodStats | null;
  initialWidgets?:       string[];
  widgetData?:           WidgetData;
}

// ── Widget registry ──────────────────────────────────────────

const DEFAULT_WIDGETS = ["revenue_today", "occupancy_today", "inactive_clients"];
const MAX_WIDGETS = 3;

const WIDGET_META: Record<string, { label: string; description: string }> = {
  revenue_today:    { label: "Faturamento hoje",      description: "Receita prevista do dia com barra de meta" },
  occupancy_today:  { label: "Ocupação hoje",          description: "% de slots ocupados e total de agendamentos" },
  inactive_clients: { label: "Clientes inativos",      description: "Clientes sem visita há mais de 30 dias" },
  monthly_goal:     { label: "Meta mensal",            description: "% da meta de receita atingida no mês" },
  avg_ticket:       { label: "Ticket médio",           description: "Valor médio por atendimento concluído no mês" },
  new_clients:      { label: "Novos clientes",         description: "Clientes cadastrados nos últimos 30 dias" },
  return_rate:      { label: "Taxa de retorno",        description: "% de clientes ativos que voltaram em 45 dias" },
  pending_apts:     { label: "Agendados hoje",         description: "Atendimentos confirmados ainda não iniciados" },
  weekly_revenue:   { label: "Faturamento da semana",  description: "Receita de atendimentos concluídos esta semana" },
  top_service:      { label: "Serviço mais popular",   description: "Serviço com mais atendimentos este mês" },
  whatsapp_queue:   { label: "WhatsApp na fila",       description: "Mensagens aguardando envio" },
};

// ── Status helpers ───────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  // Internal statuses
  SCHEDULED:    "Agendado",
  CONFIRMED:    "Confirmado",
  IN_PROGRESS:  "Em atendimento",
  COMPLETED:    "Concluído",
  CANCELLED:    "Cancelado",
  NO_SHOW:      "Não compareceu",
  // Trinks raw statuses (live data, lowercase)
  agendado:     "Agendado",
  confirmado:   "Confirmado",
  ematendimento:"Em atendimento",
  finalizado:   "Concluído",
  cancelado:    "Cancelado",
  clientefaltou:"Não compareceu",
};

const STATUS_VARIANT: Record<string, string> = {
  // Internal
  SCHEDULED:    "outline",
  CONFIRMED:    "info",
  IN_PROGRESS:  "default",
  COMPLETED:    "success",
  CANCELLED:    "destructive",
  NO_SHOW:      "warning",
  // Trinks raw (live)
  agendado:     "outline",
  confirmado:   "info",
  ematendimento:"default",
  finalizado:   "success",
  cancelado:    "destructive",
  clientefaltou:"warning",
} as never;

// ── Main Component ───────────────────────────────────────────

export function DashboardClient({
  view,
  barbershopName,
  trinksConfigured,
  liveError,
  isOffDay,
  stats,
  appointments,
  periodStats,
  initialWidgets = DEFAULT_WIDGETS,
  widgetData,
}: Props) {
  const [syncing, setSyncing]       = useState(false);
  const [offDay, setOffDay]         = useState(isOffDay);
  const [unlocking, setUnlocking]   = useState(false);
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [details, setDetails]       = useState<Record<string, AppointmentDetail | null>>({});
  const [localStatuses, setLocalStatuses] = useState<Record<string, string>>({});
  const [serviceOptions, setServiceOptions] = useState<{ id: string; name: string; price: number }[]>([]);
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [savingPayment, setSavingPayment] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState<string | null>(null);
  const [savingItem, setSavingItem] = useState<string | null>(null);
  // Reschedule animation: cards slide-out then disappear
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [hiddenIds, setHiddenIds]       = useState<Set<string>>(new Set());

  const occupancyColor =
    stats.occupancyRate >= 0.8
      ? "text-green-400"
      : stats.occupancyRate >= 0.5
      ? "text-yellow-400"
      : "text-red-400";

  // Widget preferences
  const [widgetKeys, setWidgetKeys]       = useState<string[]>(initialWidgets);
  const [showWidgetPicker, setShowWidgetPicker] = useState(false);
  const [savingWidgets, setSavingWidgets]   = useState(false);

  async function saveWidgets(keys: string[]) {
    setSavingWidgets(true);
    try {
      await fetch("/api/barbershop/widgets", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ widgets: keys }),
      });
      setWidgetKeys(keys);
    } catch {
      toast({ title: "Erro ao salvar widgets", variant: "destructive" });
    } finally {
      setSavingWidgets(false);
    }
  }

  async function loadDetail(id: string) {
    setLoadingDetail(id);
    if (serviceOptions.length === 0) {
      fetch("/api/services").then((r) => r.json()).then((d) => {
        if (d.services) setServiceOptions(d.services);
      }).catch(() => null);
    }
    try {
      const res = await fetch(`/api/appointments/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao carregar");
      setDetails((prev) => ({
        ...prev,
        [id]: {
          appointment: {
            ...appointments.find((a) => a.id === id)!,
            price: data.appointment.price ? Number(data.appointment.price) : null,
          },
          items: data.appointment.items?.map((it: any) => ({
            id: it.id,
            name: it.name,
            quantity: Number(it.quantity),
            unitPrice: Number(it.unitPrice),
            totalPrice: Number(it.totalPrice),
          })) ?? [],
          payment: data.payment
            ? {
                id: data.payment.id,
                paidValue: data.payment.paidValue ? Number(data.payment.paidValue) : null,
                discountValue: data.payment.discountValue ? Number(data.payment.discountValue) : null,
              }
            : null,
          totals: {
            subtotal: Number(data.totals.subtotal ?? 0),
            discount: Number(data.totals.discount ?? 0),
            total: Number(data.totals.total ?? 0),
            paid: Number(data.totals.paid ?? 0),
            remaining: Number(data.totals.remaining ?? 0),
          },
        } as AppointmentDetail,
      }));
    } catch (e) {
      toast({ title: "Erro ao carregar agendamento", description: String(e), variant: "destructive" });
    } finally {
      setLoadingDetail(null);
    }
  }

  function toggleExpand(id: string) {
    const next = expanded === id ? null : id;
    setExpanded(next);
    if (next && !details[next]) {
      void loadDetail(next);
    }
  }

  async function rescheduleAppointment(id: string, scheduledAt: string) {
    const newDate = new Date(scheduledAt);
    if (newDate <= new Date()) {
      toast({ title: "Data inválida", description: "Escolha uma data futura.", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch(`/api/appointments/${id}/reschedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao reagendar");
      toast({
        title: "Reagendado com sucesso",
        description: `Agendamento movido para ${newDate.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`,
      });
      // Animate card out, then remove from DOM
      setExpanded(null);
      setDismissedIds((prev) => new Set([...prev, id]));
      setTimeout(() => setHiddenIds((prev) => new Set([...prev, id])), 380);
    } catch (e) {
      toast({ title: "Erro", description: String(e), variant: "destructive" });
    }
  }

  async function updateStatus(id: string, status: string) {
    setStatusLoading(id);
    try {
      const res = await fetch(`/api/appointments/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao atualizar status");
      setLocalStatuses((prev) => ({ ...prev, [id]: status }));
      setDetails((prev) => {
        if (!prev[id]) return prev;
        return { ...prev, [id]: { ...prev[id]!, appointment: { ...prev[id]!.appointment, status } } };
      });
      toast({ title: "Status atualizado", description: status });
    } catch (e) {
      toast({ title: "Erro", description: String(e), variant: "destructive" });
    } finally {
      setStatusLoading(null);
    }
  }

  async function addItem(id: string, item: { name: string; quantity: number; unitPrice: number; serviceId?: string }) {
    setSavingItem(id);
    try {
      const res = await fetch(`/api/appointments/${id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao adicionar item");
      setDetails((prev) => {
        const det = prev[id];
        if (!det) return prev;
        const items = [...det.items, data.item].map((it: any) => ({ ...it, totalPrice: Number(it.totalPrice), unitPrice: Number(it.unitPrice), quantity: Number(it.quantity) }));
        const subtotal = items.reduce((acc, it) => acc + Number(it.totalPrice), 0);
        const discount = det.totals.discount;
        const total = Math.max(subtotal - discount, 0);
        return { ...prev, [id]: { ...det, items, totals: { ...det.totals, subtotal, total, remaining: Math.max(total - det.totals.paid, 0) } } };
      });
    } catch (e) {
      toast({ title: "Erro", description: String(e), variant: "destructive" });
    } finally {
      setSavingItem(null);
    }
  }

  async function removeItem(appointmentId: string, itemId: string) {
    setSavingItem(appointmentId);
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/items/${itemId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao remover item");
      setDetails((prev) => {
        const det = prev[appointmentId];
        if (!det) return prev;
        const items = det.items.filter((it) => it.id !== itemId);
        const subtotal = items.reduce((acc, it) => acc + Number(it.totalPrice), 0);
        const discount = det.totals.discount;
        const total = Math.max(subtotal - discount, 0);
        return { ...prev, [appointmentId]: { ...det, items, totals: { ...det.totals, subtotal, total, remaining: Math.max(total - det.totals.paid, 0) } } };
      });
    } catch (e) {
      toast({ title: "Erro", description: String(e), variant: "destructive" });
    } finally {
      setSavingItem(null);
    }
  }

  async function savePayment(id: string, paidValue: number | null, discountValue: number | null, note?: string) {
    setSavingPayment(id);
    try {
      const res = await fetch(`/api/appointments/${id}/payment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paidValue, discountValue, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar pagamento");
      setDetails((prev) => {
        const det = prev[id];
        if (!det) return prev;
        const discount = Number(discountValue ?? det.totals.discount ?? 0);
        const paid = Number(paidValue ?? det.totals.paid ?? 0);
        const subtotal = det.items.reduce((acc, it) => acc + Number(it.totalPrice), 0) || Number(det.appointment.price ?? 0);
        const total = Math.max(subtotal - discount, 0);
        return {
          ...prev,
          [id]: {
            ...det,
            payment: { id: data.payment.id, paidValue, discountValue },
            totals: { subtotal, discount, total, paid, remaining: Math.max(total - paid, 0) },
          },
        };
      });
      toast({ title: "Pagamento salvo" });
    } catch (e) {
      toast({ title: "Erro", description: String(e), variant: "destructive" });
    } finally {
      setSavingPayment(null);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/trinks/sync", { method: "POST" });
      if (!res.ok) throw new Error();
      toast({ title: "Sync concluído!", description: "Dados atualizados da Trinks." });
    } catch {
      toast({ title: "Erro no sync", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  }

  // ── Day score (today only) ───────────────────────────────
  const dayScore = (() => {
    let pts = 0;
    if (stats.occupancyRate >= 0.8) pts += 2;
    else if (stats.occupancyRate >= 0.5) pts += 1;
    const dailyGoal = stats.revenueGoal ? stats.revenueGoal / 30 : null;
    if (dailyGoal && stats.projectedRevenue >= dailyGoal) pts += 2;
    else if (dailyGoal && stats.projectedRevenue >= dailyGoal * 0.6) pts += 1;
    if (stats.inactiveClients === 0) pts += 1;
    if (pts >= 4) return { label: "Ótimo", color: "text-green-400",  bg: "bg-green-500/10 border-green-500/20",  dot: "bg-green-400" };
    if (pts >= 2) return { label: "Regular", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", dot: "bg-yellow-400" };
    return           { label: "Atenção", color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20",     dot: "bg-red-400" };
  })();

  // ── Next appointment (first not COMPLETED/CANCELLED/NO_SHOW) ──
  const nextAppt = view === "today"
    ? appointments.find((a) => {
        const s = localStatuses[a.id] ?? a.status;
        return !["COMPLETED", "CANCELLED", "NO_SHOW", "finalizado", "cancelado", "clientefaltou"].includes(s);
      })
    : null;

  return (
    <div className="p-6 space-y-5 animate-fade-in">

      {/* ── Quick shortcuts ───────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 rounded-lg border border-border bg-surface-800/50 p-1">
          {[
            { key: "today", label: "Hoje" },
            { key: "week",  label: "Esta semana" },
            { key: "month", label: "Este mês" },
          ].map(({ key, label }) => (
            <a
              key={key}
              href={`?view=${key}`}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                view === key
                  ? "bg-gold-500/15 text-gold-400 border border-gold-500/20"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Day score badge */}
          {view === "today" && (
            <span className={`hidden sm:inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${dayScore.bg} ${dayScore.color}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${dayScore.dot}`} />
              {dayScore.label}
            </span>
          )}

          {/* Action shortcuts */}
          <a href="/agenda" className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-gold-500/30 transition-colors">
            <Calendar className="h-3 w-3" /> Agenda
          </a>
          <a href="/copilot" className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-gold-500/30 transition-colors">
            <Sparkles className="h-3 w-3" /> Copilot
          </a>
          <a href="/whatsapp" className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-gold-500/30 transition-colors">
            <MessageCircle className="h-3 w-3" /> WhatsApp
          </a>

          {view === "today" && (
            <Button variant="ghost" size="sm" onClick={handleSync} disabled={syncing} className="text-xs h-7">
              <RefreshCw className={`h-3 w-3 mr-1 ${syncing ? "animate-spin" : ""}`} />
              Sync
            </Button>
          )}
        </div>
      </div>

      {liveError && view === "today" && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/8 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{liveError}</p>
        </div>
      )}

      {/* ── KPI Grid ──────────────────────────────────────── */}
      {view === "today" && offDay ? (
        /* ── Off-day banner ──────────────────────────────── */
        <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-indigo-500/8 p-8 flex flex-col items-center text-center gap-4">
          <div className="text-6xl select-none">☕</div>
          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold text-foreground">Hoje é dia de folga!</h2>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              Aproveite para descansar, cuidar de você e recarregar as energias. Amanhã a barbearia volta a todo vapor!
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground border border-blue-500/20 rounded-full px-4 py-1.5 bg-blue-500/5">
            <Scissors className="h-3.5 w-3.5 text-blue-400 shrink-0" />
            <span>Configurado como folga na sua meta de {new Date().toLocaleString("pt-BR", { month: "long" })}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-1 gap-2 border-blue-500/30 text-blue-300 hover:bg-blue-500/10 hover:text-blue-200"
            disabled={unlocking}
            onClick={async () => {
              setUnlocking(true);
              try {
                const res = await fetch("/api/goals/unlock-today", { method: "PATCH" });
                if (res.ok) setOffDay(false);
              } finally {
                setUnlocking(false);
              }
            }}
          >
            {unlocking
              ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              : <span>🙋</span>}
            Me enganei — vou trabalhar hoje
          </Button>
        </div>
      ) : view === "today" ? (
        <>
          {/* Widget picker modal */}
          {showWidgetPicker && (
            <WidgetPickerModal
              current={widgetKeys}
              onSave={(keys) => { saveWidgets(keys); setShowWidgetPicker(false); }}
              onClose={() => setShowWidgetPicker(false)}
              saving={savingWidgets}
            />
          )}

          {/* Widget grid header */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Indicadores do dia</span>
            <button
              onClick={() => setShowWidgetPicker(true)}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Personalizar
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {widgetKeys.map((key) => (
              <WidgetCard
                key={key}
                widgetKey={key}
                stats={stats}
                widgetData={widgetData}
                appointments={appointments}
                occupancyColor={occupancyColor}
              />
            ))}
          </div>
        </>
      ) : periodStats ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="Agendamentos"
            value={String(periodStats.totalAppointments)}
            subValue="não cancelados"
            icon={<Calendar className="h-4 w-4" />}
          />
          <KpiCard
            label="Receita realizada"
            value={formatBRL(periodStats.completedRevenue)}
            subValue={`${periodStats.completedCount} finalizados`}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <KpiCard
            label="Ticket médio"
            value={periodStats.completedCount > 0 ? formatBRL(periodStats.avgTicket) : "—"}
            subValue="por serviço concluído"
            icon={<BarChart3 className="h-4 w-4" />}
          />
          {view === "month" && periodStats.goalProgress !== null ? (
            <KpiCard
              label="Meta do mês"
              value={`${Math.round(periodStats.goalProgress * 100)}%`}
              subValue="da meta atingida"
              icon={<Users className="h-4 w-4" />}
              valueClass={
                periodStats.goalProgress >= 0.8
                  ? "text-green-400"
                  : periodStats.goalProgress >= 0.5
                  ? "text-yellow-400"
                  : "text-red-400"
              }
            />
          ) : (
            <KpiCard
              label="Clientes inativos"
              value={String(stats.inactiveClients)}
              subValue="+30 dias sem vir"
              icon={<Users className="h-4 w-4" />}
              valueClass={stats.inactiveClients > 0 ? "text-yellow-400" : "text-green-400"}
            />
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Sem dados para o período. Faça um sync para carregar os agendamentos.
        </div>
      )}

      {/* ── Main content ─────────────────────────────────── */}
      <div className="space-y-4">
          {view === "today" ? (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gold-400" />
                  Agenda de hoje
                  {trinksConfigured ? (
                    <Plug className="h-3.5 w-3.5 text-green-400" />
                  ) : (
                    <a href="/settings" title="Conectar Trinks">
                      <Unplug className="h-3.5 w-3.5 text-muted-foreground hover:text-gold-400 transition-colors" />
                    </a>
                  )}
                </h2>
                {/* Day score mobile */}
                <span className={`sm:hidden inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${dayScore.bg} ${dayScore.color}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${dayScore.dot}`} />
                  {dayScore.label}
                </span>
              </div>

              {/* Next appointment banner */}
              {nextAppt && (
                <div className="flex items-center gap-3 rounded-lg border border-gold-500/20 bg-gold-500/8 px-4 py-2.5">
                  <Zap className="h-4 w-4 text-gold-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Próximo atendimento</p>
                    <p className="text-sm font-semibold text-foreground truncate">
                      {formatTime(nextAppt.scheduledAt)} · {nextAppt.customerName}
                      <span className="text-muted-foreground font-normal"> — {nextAppt.serviceName}</span>
                    </p>
                  </div>
                  <span className="text-xs font-medium text-gold-400 shrink-0">{formatBRL(nextAppt.price)}</span>
                </div>
              )}

              <Card>
                <CardContent className="p-0">
                  {appointments.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground text-sm">
                      Nenhum agendamento para hoje
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
          {appointments.filter((apt) => !hiddenIds.has(apt.id)).map((apt) => (
            <div
              key={apt.id}
              className={`px-4 py-3 hover:bg-surface-800/50 border-b border-border transition-all duration-300 ease-in-out
                ${dismissedIds.has(apt.id) ? "opacity-0 translate-x-10 pointer-events-none" : "opacity-100 translate-x-0"}`}
              onClick={() => !dismissedIds.has(apt.id) && toggleExpand(apt.id)}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 text-center shrink-0">
                  <p className="text-sm font-bold text-foreground">{formatTime(apt.scheduledAt)}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{apt.customerName}</p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs text-muted-foreground truncate">{apt.serviceName}</p>
                    {apt.offerTitle && (
                      <span className="shrink-0 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] px-1.5 py-0.5">
                        🏷 {apt.offerTitle}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-medium text-foreground">{formatBRL(apt.price)}</span>
                  {(() => {
                    const s = localStatuses[apt.id] ?? apt.status;
                    return (
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_CHIP_CLASS[s] ?? "border-border text-muted-foreground"}`}>
                        {STATUS_BUTTON_ICON[s]}
                        {STATUS_LABEL[s] ?? s}
                      </span>
                    );
                  })()}
                </div>
              </div>
              {expanded === apt.id && (
                <div className="mt-3 rounded-md border border-border bg-surface-900 p-3 space-y-3" onClick={(e) => e.stopPropagation()}>
                  {loadingDetail === apt.id && <p className="text-xs text-muted-foreground">Carregando...</p>}
                  {details[apt.id] && (
                    <AppointmentPanel
                      detail={details[apt.id]!}
                      serviceOptions={serviceOptions}
                      onStatus={(s) => updateStatus(apt.id, s)}
                      statusLoading={statusLoading === apt.id}
                      onAddItem={(item) => addItem(apt.id, item)}
                      onRemoveItem={(itemId) => removeItem(apt.id, itemId)}
                      savingItem={savingItem === apt.id}
                      onSavePayment={(paid) => savePayment(apt.id, paid, null)}
                      savingPayment={savingPayment === apt.id}
                      onReschedule={(scheduledAt) => rescheduleAppointment(apt.id, scheduledAt)}
                    />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-gold-400" />
                Receita por dia
              </h2>
              <Card>
                <CardContent className="p-4">
                  {periodStats && periodStats.dailyRevenue.length > 0 ? (
                    <RevenueBarChart data={periodStats.dailyRevenue} />
                  ) : (
                    <div className="py-12 text-center text-muted-foreground text-sm">
                      Sem agendamentos concluídos no período.{" "}
                      <a href="/integrations" className="text-gold-400 underline">Sincronize a Trinks</a> para atualizar.
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────

function KpiCard({
  label, value, subValue, icon, valueClass = "text-foreground",
}: {
  label: string; value: string; subValue: string; icon: React.ReactNode; valueClass?: string;
}) {
  return (
    <Card className="hover:border-gold-500/20 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <p className={`text-2xl font-bold tabular-nums ${valueClass}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{subValue}</p>
      </CardContent>
    </Card>
  );
}

// Inline panel for appointment actions
const STATUS_BUTTON_CLASS: Record<string, string> = {
  CONFIRMED:   "border-blue-500/40 text-blue-400 hover:bg-blue-500/10",
  IN_PROGRESS: "border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10",
  COMPLETED:   "border-green-500/40 text-green-400 hover:bg-green-500/10",
  NO_SHOW:     "border-orange-500/40 text-orange-400 hover:bg-orange-500/10",
  CANCELLED:   "border-red-500/40 text-red-400 hover:bg-red-500/10",
};

// Same color palette used for the read-only status chip in the card header
const STATUS_CHIP_CLASS: Record<string, string> = {
  SCHEDULED:     "border-border text-muted-foreground",
  CONFIRMED:     "border-blue-500/40 text-blue-400",
  IN_PROGRESS:   "border-yellow-500/40 text-yellow-400",
  COMPLETED:     "border-green-500/40 text-green-400",
  NO_SHOW:       "border-orange-500/40 text-orange-400",
  CANCELLED:     "border-red-500/40 text-red-400",
  // Trinks raw
  agendado:      "border-border text-muted-foreground",
  confirmado:    "border-blue-500/40 text-blue-400",
  ematendimento: "border-yellow-500/40 text-yellow-400",
  finalizado:    "border-green-500/40 text-green-400",
  cancelado:     "border-red-500/40 text-red-400",
  clientefaltou: "border-orange-500/40 text-orange-400",
};

const STATUS_BUTTON_ICON: Record<string, React.ReactNode> = {
  CONFIRMED:      <ThumbsUp         className="h-3 w-3 mr-1" />,
  IN_PROGRESS:    <Play             className="h-3 w-3 mr-1" />,
  COMPLETED:      <Flag             className="h-3 w-3 mr-1" />,
  NO_SHOW:        <UserX            className="h-3 w-3 mr-1" />,
  CANCELLED:      <Ban              className="h-3 w-3 mr-1" />,
  // Trinks raw
  agendado:       <CalendarClockIcon className="h-3 w-3 mr-1" />,
  confirmado:     <ThumbsUp         className="h-3 w-3 mr-1" />,
  ematendimento:  <Play             className="h-3 w-3 mr-1" />,
  finalizado:     <Flag             className="h-3 w-3 mr-1" />,
  cancelado:      <Ban              className="h-3 w-3 mr-1" />,
  clientefaltou:  <UserX            className="h-3 w-3 mr-1" />,
  SCHEDULED:      <CalendarClockIcon className="h-3 w-3 mr-1" />,
};

function AppointmentPanel({
  detail,
  serviceOptions,
  onStatus,
  statusLoading,
  onAddItem,
  onRemoveItem,
  savingItem,
  onSavePayment,
  savingPayment,
  onReschedule,
}: {
  detail: AppointmentDetail;
  serviceOptions: { id: string; name: string; price: number }[];
  onStatus: (status: string) => void;
  statusLoading: boolean;
  onAddItem: (item: { name: string; quantity: number; unitPrice: number; serviceId?: string }) => void;
  onRemoveItem: (itemId: string) => void;
  savingItem: boolean;
  onSavePayment: (paid: number | null) => void;
  savingPayment: boolean;
  onReschedule: (scheduledAt: string) => void;
}) {
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [showAddService, setShowAddService] = useState(false);
  const [paid, setPaid] = useState(detail.totals.paid ? String(detail.totals.paid) : "");
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [savingReschedule, setSavingReschedule] = useState(false);

  async function handleReschedule(e: React.MouseEvent) {
    e.stopPropagation();
    if (!rescheduleDate || !rescheduleTime) return;
    const scheduledAt = new Date(`${rescheduleDate}T${rescheduleTime}`).toISOString();
    setSavingReschedule(true);
    try {
      onReschedule(scheduledAt);
      setShowReschedule(false);
    } finally {
      setSavingReschedule(false);
    }
  }

  const selectedSvc = serviceOptions.find((s) => s.id === selectedServiceId);

  // Base service (from Trinks) shown only when no items yet
  const baseService = detail.items.length === 0 && detail.appointment.serviceName && detail.appointment.price
    ? { name: detail.appointment.serviceName, price: Number(detail.appointment.price) }
    : null;

  const itemsSubtotal = detail.items.reduce((acc, it) => acc + Number(it.totalPrice), 0);
  const subtotal = detail.items.length > 0 ? itemsSubtotal : (baseService?.price ?? detail.totals.subtotal);
  const paidVal  = Number(paid || 0);
  const discount = Math.max(subtotal - paidVal, 0);
  const remaining = discount;

  return (
    <div className="space-y-4 text-xs">
      {/* Status buttons */}
      <div className="flex flex-wrap gap-2">
        {["CONFIRMED", "IN_PROGRESS", "COMPLETED", "NO_SHOW", "CANCELLED"].map((s) => (
          <Button
            key={s}
            size="sm"
            variant="outline"
            className={`h-7 text-[11px] ${STATUS_BUTTON_CLASS[s] ?? ""}`}
            onClick={(e) => { e.stopPropagation(); onStatus(s); }}
            disabled={statusLoading}
          >
            {statusLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <>{STATUS_BUTTON_ICON[s]}{STATUS_LABEL[s] ?? s}</>}
          </Button>
        ))}
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[11px] border-purple-500/40 text-purple-400 hover:bg-purple-500/10"
          onClick={(e) => { e.stopPropagation(); setShowReschedule((v) => !v); }}
        >
          <CalendarClockIcon className="h-3 w-3 mr-1" />
          Reagendar
        </Button>
      </div>

      {/* Reschedule form */}
      {showReschedule && (
        <div className="rounded-md border border-border bg-surface-800/60 p-3 space-y-2" onClick={(e) => e.stopPropagation()}>
          <p className="text-[11px] font-semibold text-foreground">Reagendar para</p>
          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              value={rescheduleDate}
              min={new Date().toISOString().split("T")[0]}
              onChange={(e) => setRescheduleDate(e.target.value)}
              className="rounded border border-border bg-surface-900 px-2 py-1 text-xs text-foreground"
            />
            <input
              type="time"
              value={rescheduleTime}
              onChange={(e) => setRescheduleTime(e.target.value)}
              className="w-24 rounded border border-border bg-surface-900 px-2 py-1 text-xs text-foreground"
            />
            <Button
              size="sm"
              className="h-7 text-[11px]"
              disabled={!rescheduleDate || !rescheduleTime || savingReschedule}
              onClick={handleReschedule}
            >
              {savingReschedule ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Confirmar"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[11px]"
              onClick={(e) => { e.stopPropagation(); setShowReschedule(false); }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Services */}
      <div className="rounded-md border border-border overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-surface-800/60">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold">
            <Scissors className="h-3.5 w-3.5 text-gold-400" /> Serviços
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">{formatBRL(subtotal)}</span>
            <button
              onClick={(e) => { e.stopPropagation(); setShowAddService((v) => !v); }}
              className="inline-flex items-center gap-1 rounded-md border border-gold-500/30 bg-gold-500/10 px-2 py-0.5 text-[10px] text-gold-400 hover:bg-gold-500/20 transition-colors"
            >
              <Plus className="h-3 w-3" /> Serviço
            </button>
          </div>
        </div>

        <div className="divide-y divide-border">
          {baseService && (
            <div className="px-3 py-2.5 flex items-center justify-between bg-surface-800/20">
              <div>
                <p className="font-medium text-foreground">{baseService.name}</p>
                <p className="text-[11px] text-muted-foreground">Agendado via Trinks</p>
              </div>
              <span className="font-semibold text-foreground">{formatBRL(baseService.price)}</span>
            </div>
          )}
          {detail.items.length === 0 && !baseService && (
            <p className="px-3 py-3 text-muted-foreground italic">Nenhum serviço adicionado.</p>
          )}
          {detail.items.map((it) => (
            <div key={it.id} className="px-3 py-2.5 flex items-center justify-between gap-2">
              <div>
                <p className="font-medium text-foreground">{it.name}</p>
                <p className="text-[11px] text-muted-foreground">Qtd {it.quantity} · {formatBRL(it.unitPrice)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{formatBRL(it.totalPrice)}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onRemoveItem(it.id); }}
                  disabled={savingItem}
                  className="text-red-400/70 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add service row — shown only when toggled */}
        {showAddService && (
          <div className="px-3 py-2.5 bg-surface-900 border-t border-border flex gap-2 items-center">
            <select
              value={selectedServiceId}
              onChange={(e) => setSelectedServiceId(e.target.value)}
              className="flex-1 rounded-md border border-border bg-surface-800 px-2 py-1.5 text-xs text-foreground"
            >
              <option value="">Selecionar serviço...</option>
              {serviceOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.name} — {formatBRL(s.price)}</option>
              ))}
            </select>
            <Button
              size="sm"
              className="h-7 text-[11px] shrink-0"
              disabled={!selectedSvc || savingItem}
              onClick={(e) => {
                e.stopPropagation();
                if (!selectedSvc) return;
                onAddItem({ name: selectedSvc.name, quantity: 1, unitPrice: selectedSvc.price, serviceId: selectedSvc.id });
                setSelectedServiceId("");
                setShowAddService(false);
              }}
            >
              {savingItem ? <RefreshCw className="h-3 w-3 animate-spin" /> : <><Plus className="h-3 w-3 mr-1" />Adicionar</>}
            </Button>
          </div>
        )}
      </div>

      {/* Payment */}
      <div className="rounded-md border border-border overflow-hidden">
        <div className="flex items-center gap-1.5 px-3 py-2 bg-surface-800/60">
          <CreditCard className="h-3.5 w-3.5 text-gold-400" />
          <span className="text-[11px] font-semibold">Pagamento</span>
        </div>
        <div className="px-3 py-3 space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Valor recebido</label>
            <input
              type="number"
              step="0.01"
              placeholder={formatBRL(subtotal)}
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-800 px-3 py-1.5 text-xs"
            />
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <div className="space-y-0.5">
              <div className="flex gap-4">
                <span className="text-muted-foreground">Total: <span className="text-foreground font-medium">{formatBRL(subtotal)}</span></span>
                {paid.trim() !== "" && discount > 0 && (
                  <span className="text-muted-foreground">Desconto: <span className="text-yellow-400 font-medium">-{formatBRL(discount)}</span></span>
                )}
              </div>
              {paid.trim() !== "" && (
                <div>
                  <span className={remaining > 0 ? "text-yellow-400 font-semibold" : "text-green-400 font-semibold"}>
                    {remaining > 0 ? `Restante: ${formatBRL(remaining)}` : "Pago ✓"}
                  </span>
                </div>
              )}
            </div>
            <Button
              size="sm"
              className="text-[11px] h-8"
              disabled={savingPayment}
              onClick={(e) => { e.stopPropagation(); onSavePayment(paidVal > 0 ? paidVal : null); }}
            >
              {savingPayment ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RevenueBarChart({ data }: { data: { day: string; revenue: number; count: number }[] }) {
  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);
  return (
    <div className="space-y-3">
      <div className="flex items-end gap-1.5 h-32">
        {data.map((d) => (
          <div key={d.day} className="group flex-1 flex flex-col items-center gap-1">
            <div className="relative w-full flex flex-col items-center justify-end" style={{ height: "100px" }}>
              {d.revenue > 0 && (
                <div
                  className="absolute bottom-0 w-full rounded-t-md bg-gold-500/40 group-hover:bg-gold-500/60 transition-colors"
                  style={{ height: `${Math.max((d.revenue / maxRevenue) * 100, 8)}%` }}
                />
              )}
              {d.count > 0 && d.revenue === 0 && (
                <div className="absolute bottom-0 w-full rounded-t-md bg-surface-700" style={{ height: "8%" }} />
              )}
            </div>
            <p className="text-[9px] text-muted-foreground truncate w-full text-center">{d.day}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground border-t border-border pt-2">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-gold-500/40" />
          Receita realizada
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-surface-700" />
          Agendado (sem conclusão)
        </span>
      </div>
    </div>
  );
}

// ── WidgetCard ───────────────────────────────────────────────

function WidgetCard({
  widgetKey,
  stats,
  widgetData,
  appointments,
  occupancyColor,
}: {
  widgetKey:      string;
  stats:          Stats;
  widgetData?:    WidgetData;
  appointments:   Appointment[];
  occupancyColor: string;
}) {
  const pendingCount = appointments.filter(
    (a) => a.status === "SCHEDULED" || a.status === "CONFIRMED" || a.status === "agendado" || a.status === "confirmado"
  ).length;

  switch (widgetKey) {
    case "revenue_today": {
      const workDays  = stats.workingDaysCount ?? 30;
      const dailyGoal = stats.revenueGoal ? stats.revenueGoal / workDays : null;
      const pct       = dailyGoal ? Math.min(stats.projectedRevenue / dailyGoal, 1) : null;
      const barColor  = pct == null ? "bg-gold-500" : pct >= 1 ? "bg-green-500" : pct >= 0.6 ? "bg-gold-500" : "bg-red-500";
      return (
        <Card className="hover:border-gold-500/20 transition-colors col-span-2 lg:col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground font-medium">Faturamento previsto hoje</p>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-3xl font-bold tabular-nums text-foreground">{formatBRL(stats.projectedRevenue)}</p>
            {dailyGoal ? (
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Meta diária: {formatBRL(dailyGoal)} <span className="opacity-60">({workDays} dias úteis)</span></span>
                  <span className={pct != null && pct >= 1 ? "text-green-400" : ""}>{pct != null ? Math.round(pct * 100) : 0}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-700 overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct != null ? Math.round(pct * 100) : 0}%` }} />
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-2">Sem meta definida — <a href="/financeiro" className="text-gold-400 hover:underline">definir meta</a></p>
            )}
          </CardContent>
        </Card>
      );
    }

    case "occupancy_today":
      return (
        <KpiCard
          label="Ocupação hoje"
          value={`${Math.round(stats.occupancyRate * 100)}%`}
          subValue={`${stats.bookedSlots} de ${stats.totalSlots} slots`}
          icon={<Calendar className="h-4 w-4" />}
          valueClass={occupancyColor}
        />
      );

    case "inactive_clients":
      return (
        <KpiCard
          label="Clientes inativos"
          value={String(stats.inactiveClients)}
          subValue="+30 dias sem vir"
          icon={<Users className="h-4 w-4" />}
          valueClass={stats.inactiveClients > 0 ? "text-yellow-400" : "text-green-400"}
        />
      );

    case "monthly_goal": {
      const pct = widgetData?.monthlyGoalPct;
      const pctNum = pct != null ? Math.round(pct * 100) : null;
      return (
        <KpiCard
          label="Meta mensal"
          value={pctNum != null ? `${pctNum}%` : "—"}
          subValue="da meta atingida"
          icon={<Target className="h-4 w-4" />}
          valueClass={pctNum == null ? "" : pctNum >= 80 ? "text-green-400" : pctNum >= 50 ? "text-yellow-400" : "text-red-400"}
        />
      );
    }

    case "avg_ticket":
      return (
        <KpiCard
          label="Ticket médio"
          value={widgetData?.avgTicket != null ? formatBRL(widgetData.avgTicket) : "—"}
          subValue="por atendimento este mês"
          icon={<BarChart3 className="h-4 w-4" />}
        />
      );

    case "new_clients":
      return (
        <KpiCard
          label="Novos clientes"
          value={widgetData?.newClients != null ? String(widgetData.newClients) : "—"}
          subValue="últimos 30 dias"
          icon={<UserPlus className="h-4 w-4" />}
          valueClass="text-green-400"
        />
      );

    case "return_rate":
      return (
        <KpiCard
          label="Taxa de retorno"
          value={widgetData?.returnRate != null ? `${widgetData.returnRate}%` : "—"}
          subValue="retornaram em 45 dias"
          icon={<Repeat2 className="h-4 w-4" />}
          valueClass={
            widgetData?.returnRate == null ? "" :
            widgetData.returnRate >= 60 ? "text-green-400" :
            widgetData.returnRate >= 40 ? "text-yellow-400" : "text-red-400"
          }
        />
      );

    case "pending_apts":
      return (
        <KpiCard
          label="Agendados hoje"
          value={String(pendingCount)}
          subValue="confirmados ou aguardando"
          icon={<Calendar className="h-4 w-4" />}
          valueClass="text-blue-400"
        />
      );

    case "weekly_revenue":
      return (
        <KpiCard
          label="Receita da semana"
          value={widgetData?.weeklyRevenue != null ? formatBRL(widgetData.weeklyRevenue) : "—"}
          subValue="atendimentos concluídos"
          icon={<TrendingUp className="h-4 w-4" />}
        />
      );

    case "top_service":
      return (
        <KpiCard
          label="Serviço mais popular"
          value={widgetData?.topService ?? "—"}
          subValue="mais agendado este mês"
          icon={<Star className="h-4 w-4" />}
          valueClass="text-gold-400"
        />
      );

    case "whatsapp_queue":
      return (
        <KpiCard
          label="WhatsApp na fila"
          value={widgetData?.whatsappQueue != null ? String(widgetData.whatsappQueue) : "—"}
          subValue="mensagens aguardando envio"
          icon={<MessageSquare className="h-4 w-4" />}
          valueClass={widgetData?.whatsappQueue ? "text-amber-400" : "text-green-400"}
        />
      );

    default:
      return null;
  }
}

// ── WidgetPickerModal ────────────────────────────────────────

function WidgetPickerModal({
  current,
  onSave,
  onClose,
  saving,
}: {
  current:  string[];
  onSave:   (keys: string[]) => void;
  onClose:  () => void;
  saving:   boolean;
}) {
  const [selected, setSelected] = useState<string[]>(current);
  const [limitWarn, setLimitWarn] = useState(false);

  function toggle(key: string) {
    if (selected.includes(key)) {
      setSelected(selected.filter((k) => k !== key));
      setLimitWarn(false);
    } else {
      if (selected.length >= MAX_WIDGETS) {
        setLimitWarn(true);
        return;
      }
      setSelected([...selected, key]);
      setLimitWarn(false);
    }
  }

  const allKeys = Object.keys(WIDGET_META);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-foreground text-sm">Personalizar widgets</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Escolha até {MAX_WIDGETS} indicadores para exibir</p>
          </div>
          <button onClick={onClose} className="rounded p-1.5 hover:bg-surface-700 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Slots indicator */}
          <div className="flex items-center gap-2">
            {Array.from({ length: MAX_WIDGETS }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${i < selected.length ? "bg-gold-500" : "bg-surface-700"}`}
              />
            ))}
            <span className="text-[11px] text-muted-foreground shrink-0">{selected.length}/{MAX_WIDGETS}</span>
          </div>

          {limitWarn && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-400">
              Você já tem {MAX_WIDGETS} widgets selecionados. Remova um para adicionar outro.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {allKeys.map((key) => {
              const meta    = WIDGET_META[key];
              const active  = selected.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggle(key)}
                  className={`text-left rounded-lg border p-3 transition-all ${
                    active
                      ? "border-gold-500/50 bg-gold-500/8 ring-1 ring-gold-500/30"
                      : "border-border hover:border-border/80 hover:bg-surface-800/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground leading-snug">{meta.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{meta.description}</p>
                    </div>
                    <div className={`shrink-0 mt-0.5 h-4 w-4 rounded-full border-2 transition-colors ${active ? "border-gold-500 bg-gold-500" : "border-muted-foreground/40"}`}>
                      {active && <CheckCircle2 className="h-3 w-3 text-black" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-border px-5 py-3 flex gap-2 justify-end">
          <Button variant="ghost" size="sm" className="text-xs" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button
            size="sm"
            className="text-xs gap-1"
            onClick={() => onSave(selected)}
            disabled={saving || selected.length === 0}
          >
            {saving ? <RefreshCw className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
