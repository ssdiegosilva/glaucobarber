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
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

// ── Types ────────────────────────────────────────────────────

interface Stats {
  totalSlots:       number;
  bookedSlots:      number;
  freeSlots:        number;
  occupancyRate:    number;
  completedRevenue: number;
  projectedRevenue: number;
  revenueGoal:      number | null;
  inactiveClients:  number;
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
  stats:                 Stats;
  appointments:          Appointment[];
  suggestions:           Suggestion[];
  approvedSuggestions?:  Suggestion[];
  campaign:              Campaign | null;
  periodStats:           PeriodStats | null;
}

// ── Status helpers ───────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED:   "Agendado",
  CONFIRMED:   "Confirmado",
  IN_PROGRESS: "Em atendimento",
  COMPLETED:   "Concluído",
  CANCELLED:   "Cancelado",
  NO_SHOW:     "Não compareceu",
};

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "destructive" | "outline"> = {
  SCHEDULED:   "outline",
  CONFIRMED:   "info",
  IN_PROGRESS: "default",
  COMPLETED:   "success",
  CANCELLED:   "destructive",
  NO_SHOW:     "warning",
} as never;

// ── Main Component ───────────────────────────────────────────

export function DashboardClient({
  view,
  barbershopName,
  trinksConfigured,
  liveError,
  stats,
  appointments,
  suggestions,
  approvedSuggestions = [],
  campaign,
  periodStats,
}: Props) {
  const [localSuggestions, setLocalSuggestions] = useState(suggestions);
  const [localApproved] = useState(approvedSuggestions);
  const [approving, setApproving]   = useState<string | null>(null);
  const [syncing, setSyncing]       = useState(false);
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [details, setDetails]       = useState<Record<string, AppointmentDetail | null>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [savingPayment, setSavingPayment] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState<string | null>(null);
  const [savingItem, setSavingItem] = useState<string | null>(null);

  const occupancyColor =
    stats.occupancyRate >= 0.8
      ? "text-green-400"
      : stats.occupancyRate >= 0.5
      ? "text-yellow-400"
      : "text-red-400";

  async function handleApproveSuggestion(id: string) {
    setApproving(id);
    try {
      const res = await fetch(`/api/suggestions/${id}/approve`, { method: "POST" });
      if (!res.ok) throw new Error();
      setLocalSuggestions((prev) => prev.filter((s) => s.id !== id));
      toast({ title: "Sugestão aprovada!", description: "A ação foi registrada." });
    } catch {
      toast({ title: "Erro ao aprovar", variant: "destructive" });
    } finally {
      setApproving(null);
    }
  }

  async function loadDetail(id: string) {
    setLoadingDetail(id);
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

  return (
    <div className="p-6 space-y-6 animate-fade-in">

      {/* ── View Tabs ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
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

        {view === "today" && (
          <Button variant="ghost" size="sm" onClick={handleSync} disabled={syncing} className="text-xs h-7">
            <RefreshCw className={`h-3 w-3 mr-1 ${syncing ? "animate-spin" : ""}`} />
            Sync Trinks
          </Button>
        )}
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
      {view === "today" ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="Ocupação hoje"
            value={`${Math.round(stats.occupancyRate * 100)}%`}
            subValue={`${stats.bookedSlots}/${stats.totalSlots} slots`}
            icon={<Calendar className="h-4 w-4" />}
            valueClass={occupancyColor}
          />
          <KpiCard
            label="Horários livres"
            value={String(stats.freeSlots)}
            subValue="disponíveis hoje"
            icon={<Clock className="h-4 w-4" />}
            valueClass={stats.freeSlots > 3 ? "text-red-400" : "text-green-400"}
          />
          <KpiCard
            label="Faturamento previsto"
            value={formatBRL(stats.projectedRevenue)}
            subValue={stats.revenueGoal ? `Meta: ${formatBRL(stats.revenueGoal / 30)}` : "sem meta definida"}
            icon={<TrendingUp className="h-4 w-4" />}
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
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gold-400" />
                Agenda de hoje
              </h2>
              <Card>
                <CardContent className="p-0">
                  {appointments.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground text-sm">
                      Nenhum agendamento para hoje
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
          {appointments.map((apt) => (
            <div
              key={apt.id}
              className="px-4 py-3 hover:bg-surface-800/50 transition-colors border-b border-border"
              onClick={() => toggleExpand(apt.id)}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 text-center shrink-0">
                  <p className="text-sm font-bold text-foreground">{formatTime(apt.scheduledAt)}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{apt.customerName}</p>
                  <p className="text-xs text-muted-foreground truncate">{apt.serviceName}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-medium text-foreground">{formatBRL(apt.price)}</span>
                  <Badge variant={STATUS_VARIANT[apt.status] as never}>
                    {apt.statusLabel ?? STATUS_LABEL[apt.status] ?? apt.status}
                  </Badge>
                </div>
              </div>
              {expanded === apt.id && (
                <div className="mt-3 rounded-md border border-border bg-surface-900 p-3 space-y-3">
                  {loadingDetail === apt.id && <p className="text-xs text-muted-foreground">Carregando...</p>}
                  {details[apt.id] && (
                    <AppointmentPanel
                      detail={details[apt.id]!}
                      onStatus={(s) => updateStatus(apt.id, s)}
                      statusLoading={statusLoading === apt.id}
                      onAddItem={(item) => addItem(apt.id, item)}
                      onRemoveItem={(itemId) => removeItem(apt.id, itemId)}
                      savingItem={savingItem === apt.id}
                      onSavePayment={(paid, discount) => savePayment(apt.id, paid, discount)}
                      savingPayment={savingPayment === apt.id}
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
                  approving={approving === s.id}
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
function AppointmentPanel({
  detail,
  onStatus,
  statusLoading,
  onAddItem,
  onRemoveItem,
  savingItem,
  onSavePayment,
  savingPayment,
}: {
  detail: AppointmentDetail;
  onStatus: (status: string) => void;
  statusLoading: boolean;
  onAddItem: (item: { name: string; quantity: number; unitPrice: number; serviceId?: string }) => void;
  onRemoveItem: (itemId: string) => void;
  savingItem: boolean;
  onSavePayment: (paid: number | null, discount: number | null) => void;
  savingPayment: boolean;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("1");
  const [paid, setPaid] = useState(detail.totals.paid ? String(detail.totals.paid) : "");
  const [discount, setDiscount] = useState(detail.totals.discount ? String(detail.totals.discount) : "");

  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-wrap gap-2">
        {["CONFIRMED", "IN_PROGRESS", "COMPLETED", "NO_SHOW", "CANCELLED"].map((s) => (
          <Button
            key={s}
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            onClick={(e) => { e.stopPropagation(); onStatus(s); }}
            disabled={statusLoading}
          >
            {statusLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : STATUS_LABEL[s] ?? s}
          </Button>
        ))}
      </div>

      <div className="border border-border rounded-md">
        <div className="flex items-center justify-between px-3 py-2 bg-surface-800/60">
          <span className="text-[11px] font-semibold">Serviços</span>
          <span className="text-[11px] text-muted-foreground">Subtotal {formatBRL(detail.totals.subtotal)}</span>
        </div>
        <div className="divide-y divide-border">
          {detail.items.length === 0 && (
            <p className="px-3 py-2 text-muted-foreground">Sem itens. Adicione um serviço.</p>
          )}
          {detail.items.map((it) => (
            <div key={it.id} className="px-3 py-2 flex items-center justify-between gap-2">
              <div>
                <p className="font-medium text-foreground">{it.name}</p>
                <p className="text-muted-foreground text-[11px]">Qtd {it.quantity} · {formatBRL(it.unitPrice)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{formatBRL(it.totalPrice)}</span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={(e) => { e.stopPropagation(); onRemoveItem(it.id); }}
                  disabled={savingItem}
                  title="Remover"
                >
                  <XCircle className="h-3.5 w-3.5 text-red-400" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="px-3 py-2 bg-surface-900 flex flex-col md:flex-row gap-2">
          <input
            placeholder="Serviço"
            className="rounded-md border border-border bg-surface-800 px-2 py-1 text-xs flex-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="number"
            placeholder="Qtd"
            className="rounded-md border border-border bg-surface-800 px-2 py-1 text-xs w-16"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          <input
            type="number"
            step="0.01"
            placeholder="Preço"
            className="rounded-md border border-border bg-surface-800 px-2 py-1 text-xs w-24"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <Button
            size="sm"
            className="text-[11px]"
            disabled={!name || !price || savingItem}
            onClick={(e) => {
              e.stopPropagation();
              onAddItem({ name, quantity: Number(qty || "1"), unitPrice: Number(price) });
              setName(""); setPrice(""); setQty("1");
            }}
          >
            {savingItem ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Adicionar"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">Desconto</label>
          <input
            type="number"
            step="0.01"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            className="w-full rounded-md border border-border bg-surface-800 px-2 py-1 text-xs"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">Valor pago</label>
          <input
            type="number"
            step="0.01"
            value={paid}
            onChange={(e) => setPaid(e.target.value)}
            className="w-full rounded-md border border-border bg-surface-800 px-2 py-1 text-xs"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] space-x-2">
          <span>Subtotal {formatBRL(detail.totals.subtotal)}</span>
          <span>Desconto {formatBRL(Number(discount || detail.totals.discount || 0))}</span>
          <span>Total {formatBRL(detail.totals.total)}</span>
          <span>Restante {formatBRL(detail.totals.remaining)}</span>
        </div>
        <Button
          size="sm"
          className="text-[11px]"
          disabled={savingPayment}
          onClick={(e) => {
            e.stopPropagation();
            onSavePayment(paid ? Number(paid) : null, discount ? Number(discount) : null);
          }}
        >
          {savingPayment ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Salvar pagamento"}
        </Button>
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

function SuggestionCard({
  suggestion, onApprove, onDismiss, approving,
}: {
  suggestion: Suggestion;
  onApprove:  () => void;
  onDismiss:  () => void;
  approving:  boolean;
}) {
  const ICONS: Record<string, React.ReactNode> = {
    COMMERCIAL_INSIGHT: <TrendingUp className="h-3.5 w-3.5" />,
    CAMPAIGN_TEXT:      <Megaphone className="h-3.5 w-3.5" />,
    CLIENT_MESSAGE:     <Users className="h-3.5 w-3.5" />,
    SOCIAL_POST:        <ArrowUpRight className="h-3.5 w-3.5" />,
    OFFER_OPPORTUNITY:  <Sparkles className="h-3.5 w-3.5" />,
  };

  return (
    <Card className="border-gold-500/15 hover:border-gold-500/30 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start gap-2 mb-2">
          <span className="mt-0.5 text-gold-400 shrink-0">
            {ICONS[suggestion.type] ?? <Sparkles className="h-3.5 w-3.5" />}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground leading-snug">{suggestion.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{suggestion.reason}</p>
          </div>
        </div>

        <p className="text-xs text-foreground/80 leading-relaxed mt-2 line-clamp-3">
          {suggestion.content}
        </p>

        <div className="flex gap-2 mt-3">
          <Button
            size="sm"
            className="flex-1 h-7 text-xs"
            onClick={onApprove}
            disabled={approving}
          >
            <CheckCircle2 className="h-3 w-3" />
            {approving ? "..." : "Aprovar"}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDismiss}
            className="h-7 w-7 text-muted-foreground"
          >
            <XCircle className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
