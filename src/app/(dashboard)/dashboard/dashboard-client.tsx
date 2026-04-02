"use client";

import { useState, useRef, useEffect } from "react";
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
  MessageCircle, Zap, ChevronDown,
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

interface Suggestion {
  id:      string;
  type:    string;
  title:   string;
  content: string;
  reason:  string;
}

interface Campaign {
  id:      string;
  title:   string;
  text:    string;
  channel: string;
}

interface PeriodStats {
  totalAppointments: number;
  completedCount:    number;
  completedRevenue:  number;
  avgTicket:         number;
  goalProgress:      number | null;
  dailyRevenue:      { day: string; revenue: number; count: number }[];
}

interface Props {
  view:                  "today" | "week" | "month";
  barbershopName:        string;
  trinksConfigured:      boolean;
  liveError?:            string;
  isOffDay:              boolean;
  stats:                 Stats;
  appointments:          Appointment[];
  suggestions:           Suggestion[];
  approvedSuggestions?:  Suggestion[];
  campaign:              Campaign | null;
  periodStats:           PeriodStats | null;
  dailyGiftAvailable?:   boolean;
}

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
  suggestions,
  approvedSuggestions = [],
  campaign,
  periodStats,
  dailyGiftAvailable = false,
}: Props) {
  const [localSuggestions, setLocalSuggestions] = useState(suggestions);
  const [localApproved] = useState(approvedSuggestions);
  const [approving, setApproving]   = useState<string | null>(null);
  const [syncing, setSyncing]       = useState(false);
  const [generating, setGenerating] = useState(false);
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

  // Track post-approval state per suggestion (id → whatsappQueued)
  const [approvedMap, setApprovedMap] = useState<Record<string, boolean>>({});

  // Daily gift: auto-generate suggestions on first access of the day (free, no credit deducted)
  useEffect(() => {
    if (!dailyGiftAvailable) return;
    setGenerating(true);
    fetch("/api/ai/suggestions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gift: true }) })
      .then((r) => r.json())
      .then((data) => {
        if (data.suggestions?.length) {
          const newOnes = data.suggestions.map((s: any) => ({
            id: s.id ?? crypto.randomUUID(),
            type: s.type ?? "COMMERCIAL_INSIGHT",
            title: s.title ?? "Sugestão",
            content: s.content ?? "",
            reason: s.reason ?? "",
          }));
          setLocalSuggestions((prev) => [...newOnes, ...prev]);
          toast({ title: "✨ Sugestões do dia geradas!", description: `${newOnes.length} ideias prontas para você — presente diário da IA.` });
          window.dispatchEvent(new Event("ai-used"));
        }
      })
      .catch(() => { /* silently ignore — not critical */ })
      .finally(() => setGenerating(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleApproveSuggestion(id: string) {
    setApproving(id);
    try {
      const res = await fetch(`/api/suggestions/${id}/approve`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      // Transition card to approved state instead of removing it
      setApprovedMap((prev) => ({ ...prev, [id]: !!data.whatsappQueued }));
    } catch {
      toast({ title: "Erro ao aprovar", variant: "destructive" });
    } finally {
      setApproving(null);
    }
  }

  function handleClearSuggestion(id: string) {
    setApprovedMap((prev) => { const n = { ...prev }; delete n[id]; return n; });
    setLocalSuggestions((prev) => prev.filter((s) => s.id !== id));
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

  async function handleDismissSuggestion(id: string) {
    try {
      await fetch(`/api/suggestions/${id}/dismiss`, { method: "POST" });
      setLocalSuggestions((prev) => prev.filter((s) => s.id !== id));
    } catch {
      toast({ title: "Erro ao dispensar", variant: "destructive" });
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/suggestions", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao gerar sugestões");
      window.dispatchEvent(new Event("ai-used"));
      const newOnes = (data.suggestions ?? []).map((s: any) => ({
        id: s.id ?? crypto.randomUUID(),
        type: s.type ?? "COMMERCIAL_INSIGHT",
        title: s.title ?? "Sugestão",
        content: s.content ?? "",
        reason: s.reason ?? "",
      }));
      setLocalSuggestions((prev) => [...newOnes, ...prev]);
      toast({ title: "Sugestões geradas", description: `${newOnes.length} novas ideias da IA.` });
    } catch (err) {
      toast({ title: "Erro ao gerar", description: String(err), variant: "destructive" });
    } finally {
      setGenerating(false);
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

      {/* Trinks warnings */}
      {!trinksConfigured && (
        <div className="flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/8 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0" />
          <p className="text-sm text-yellow-300">
            Trinks não configurada.{" "}
            <a href="/integrations" className="font-semibold underline">Configure agora</a> para ver a agenda ao vivo.
          </p>
        </div>
      )}
      {liveError && view === "today" && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/8 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{liveError}</p>
        </div>
      )}

      {/* ── KPI Grid ──────────────────────────────────────── */}
      {view === "today" && isOffDay ? (
        /* ── Off-day banner ──────────────────────────────── */
        <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 p-6 flex flex-col items-center text-center gap-3">
          <div className="text-5xl">☕</div>
          <h2 className="text-xl font-bold text-foreground">Hoje você está de folga!</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            Aproveite para descansar, cuidar de você e recarregar as energias. Amanhã a barbearia volta a todo vapor!
          </p>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground border border-border rounded-full px-4 py-1.5">
            <Scissors className="h-3.5 w-3.5 text-gold-400" />
            <span>Você configurou este dia como folga na sua meta mensal</span>
          </div>
        </div>
      ) : view === "today" ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Featured: Faturamento (spans 2 on large) */}
          <Card className="hover:border-gold-500/20 transition-colors col-span-2 lg:col-span-2">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground font-medium">Faturamento previsto hoje</p>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-3xl font-bold tabular-nums text-foreground">{formatBRL(stats.projectedRevenue)}</p>
              {stats.revenueGoal ? (() => {
                const workDays = stats.workingDaysCount ?? 30;
                const dailyGoal = stats.revenueGoal / workDays;
                const pct = Math.min(stats.projectedRevenue / dailyGoal, 1);
                const color = pct >= 1 ? "bg-green-500" : pct >= 0.6 ? "bg-gold-500" : "bg-red-500";
                return (
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Meta diária: {formatBRL(dailyGoal)} <span className="opacity-60">({workDays} dias úteis)</span></span>
                      <span className={pct >= 1 ? "text-green-400" : ""}>{Math.round(pct * 100)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-700 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.round(pct * 100)}%` }} />
                    </div>
                  </div>
                );
              })() : <p className="text-xs text-muted-foreground mt-2">Sem meta definida — <a href="/financeiro" className="text-gold-400 hover:underline">definir meta</a></p>}
            </CardContent>
          </Card>

          <KpiCard
            label="Ocupação hoje"
            value={`${Math.round(stats.occupancyRate * 100)}%`}
            subValue={`${stats.bookedSlots} de ${stats.totalSlots} slots`}
            icon={<Calendar className="h-4 w-4" />}
            valueClass={occupancyColor}
          />
          <KpiCard
            label="Clientes inativos"
            value={String(stats.inactiveClients)}
            subValue="+30 dias sem vir"
            icon={<Users className="h-4 w-4" />}
            valueClass={stats.inactiveClients > 0 ? "text-yellow-400" : "text-green-400"}
          />
        </div>
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

      {/* ── Main 2-col layout ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Left column — agenda (today) or chart (week/month) */}
        <div className="lg:col-span-3 space-y-4">
          {view === "today" ? (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gold-400" />
                  Agenda de hoje
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

        {/* Right column — IA Suggestions (all views) */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold-400" />
            Sugestões da IA
          </h2>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleGenerate} disabled={generating}>
              {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Gerar novas
            </Button>
            {localApproved.length > 0 && (
              <Button size="sm" variant="outline" asChild>
                <a href="#approved-suggestions">Ver aprovadas</a>
              </Button>
            )}
          </div>

          {localSuggestions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                Sem sugestões pendentes
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {localSuggestions.map((s) => (
                <SuggestionCard
                  key={s.id}
                  suggestion={s}
                  onApprove={() => handleApproveSuggestion(s.id)}
                  onDismiss={() => handleDismissSuggestion(s.id)}
                  onClear={() => handleClearSuggestion(s.id)}
                  approving={approving === s.id}
                  approvedState={s.id in approvedMap ? { whatsappQueued: approvedMap[s.id] } : undefined}
                />
              ))}
            </div>
          )}

          {campaign && (
            <Card className="border-gold-500/20">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-gold-400" />
                  <CardTitle className="text-sm">Campanha Aprovada</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs font-medium text-foreground mb-1">{campaign.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{campaign.text}</p>
                <div className="mt-3 flex items-center justify-between">
                  <Badge variant="success">{campaign.channel || "instagram"}</Badge>
                  <a href="/campaigns" className="text-xs text-gold-400 hover:underline flex items-center gap-1">
                    Ver campanha <ChevronRight className="h-3 w-3" />
                  </a>
                </div>
              </CardContent>
            </Card>
          )}

          {localApproved.length > 0 && (
            <div className="space-y-2" id="approved-suggestions">
              <h3 className="text-xs font-semibold text-foreground/80">Sugestões aprovadas</h3>
              <div className="grid gap-2">
                {localApproved.map((s) => (
                  <Card key={s.id} className="border-gold-500/15">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-foreground leading-snug">{s.title}</p>
                        <Badge variant="outline" className="text-[10px]">{s.type}</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed line-clamp-3">{s.content}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
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

const SUGGESTION_ICONS: Record<string, React.ReactNode> = {
  COMMERCIAL_INSIGHT: <TrendingUp    className="h-3.5 w-3.5" />,
  CAMPAIGN_TEXT:      <Megaphone     className="h-3.5 w-3.5" />,
  CLIENT_MESSAGE:     <MessageCircle className="h-3.5 w-3.5" />,
  SOCIAL_POST:        <ArrowUpRight  className="h-3.5 w-3.5" />,
  OFFER_OPPORTUNITY:  <Sparkles      className="h-3.5 w-3.5" />,
  PROMO_BRIEFING:     <Megaphone     className="h-3.5 w-3.5" />,
};

const APPROVAL_LINK: Record<string, { href: string; label: string } | undefined> = {
  CLIENT_MESSAGE:     { href: "/whatsapp",  label: "Ver na fila do WhatsApp" },
  CAMPAIGN_TEXT:      { href: "/campaigns", label: "Ver campanhas" },
  SOCIAL_POST:        { href: "/campaigns", label: "Ver campanhas" },
  PROMO_BRIEFING:     { href: "/campaigns", label: "Ver campanhas" },
  OFFER_OPPORTUNITY:  { href: "/offers",    label: "Ver ofertas" },
  COMMERCIAL_INSIGHT: undefined,
};

function SuggestionCard({
  suggestion,
  onApprove,
  onDismiss,
  onClear,
  approving,
  approvedState,
}: {
  suggestion:    Suggestion;
  onApprove:     () => void;
  onDismiss:     () => void;
  onClear:       () => void;
  approving:     boolean;
  approvedState?: { whatsappQueued: boolean };
}) {
  const touchStartX = useRef(0);
  const [swipeDx, setSwipeDx]   = useState(0);
  const [swiping, setSwiping]   = useState(false);
  const SWIPE_THRESHOLD = 80;

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    setSwiping(true);
  }
  function onTouchMove(e: React.TouchEvent) {
    const dx = touchStartX.current - e.touches[0].clientX;
    if (dx > 0) setSwipeDx(Math.min(dx, SWIPE_THRESHOLD + 20));
  }
  function onTouchEnd() {
    setSwiping(false);
    if (swipeDx >= SWIPE_THRESHOLD) {
      onClear();
    } else {
      setSwipeDx(0);
    }
  }

  const link = APPROVAL_LINK[suggestion.type];
  const icon = SUGGESTION_ICONS[suggestion.type] ?? <Sparkles className="h-3.5 w-3.5" />;

  // ── Approved state ──────────────────────────────────────────
  if (approvedState) {
    const isWhatsApp = suggestion.type === "CLIENT_MESSAGE";
    return (
      <div
        className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-emerald-500/5 transition-transform"
        style={{ transform: `translateX(-${swipeDx}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Swipe-reveal delete zone */}
        <div
          className="absolute right-0 top-0 bottom-0 flex items-center px-5 bg-red-500/80 text-white text-xs font-medium gap-1.5 rounded-r-xl pointer-events-none"
          style={{ opacity: swipeDx > 20 ? Math.min(1, (swipeDx - 20) / 40) : 0 }}
        >
          <Trash2 className="h-4 w-4" />
          Limpar
        </div>

        <div className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0">
              <span className="mt-0.5 text-emerald-400 shrink-0">{icon}</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground leading-snug">{suggestion.title}</p>
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 mt-0.5">
                  <CheckCircle2 className="h-3 w-3" /> Aprovado
                </span>
              </div>
            </div>
            <button
              onClick={onClear}
              className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-surface-700 transition-colors"
              title="Limpar"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <p className="text-xs text-foreground/80 leading-relaxed">{suggestion.content}</p>

          {/* WhatsApp notice */}
          {isWhatsApp && approvedState.whatsappQueued && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-300 leading-relaxed">
              Sua mensagem foi para a fila de envio e será enviada em <strong>30 minutos</strong>. Para editar ou cancelar, acesse a área do WhatsApp.
            </div>
          )}

          {/* Link */}
          {link && (
            <a
              href={link.href}
              className="inline-flex items-center gap-1.5 text-xs text-gold-400 hover:text-gold-300 hover:underline transition-colors"
            >
              {link.label}
              <ChevronRight className="h-3 w-3" />
            </a>
          )}

          {/* Clear button */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-7 text-xs text-muted-foreground hover:text-foreground"
            onClick={onClear}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Limpar
          </Button>
        </div>
      </div>
    );
  }

  // ── Pending state ───────────────────────────────────────────
  return (
    <div
      className="relative overflow-hidden rounded-xl transition-transform"
      style={{ transform: `translateX(-${swipeDx}px)` }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Swipe-reveal delete zone */}
      <div
        className="absolute right-0 top-0 bottom-0 flex items-center px-5 bg-red-500/80 text-white text-xs font-medium gap-1.5 rounded-r-xl pointer-events-none"
        style={{ opacity: swipeDx > 20 ? Math.min(1, (swipeDx - 20) / 40) : 0 }}
      >
        <Trash2 className="h-4 w-4" />
        Dispensar
      </div>

      <Card className="border-gold-500/15 hover:border-gold-500/30 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-start gap-2 mb-2">
            <span className="mt-0.5 text-gold-400 shrink-0">{icon}</span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground leading-snug">{suggestion.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{suggestion.reason}</p>
            </div>
          </div>

          <p className="text-xs text-foreground/80 leading-relaxed mt-2 line-clamp-3">
            {suggestion.content}
          </p>

          <div className="grid grid-cols-2 gap-2 mt-3">
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={onApprove}
              disabled={approving}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {approving ? "Aprovando..." : "Aprovar"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-red-400 hover:border-red-400/40"
              onClick={onDismiss}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Excluir
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
