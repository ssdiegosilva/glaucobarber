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
  view:             "today" | "week" | "month";
  barbershopName:   string;
  trinksConfigured: boolean;
  liveError?:       string;
  stats:            Stats;
  appointments:     Appointment[];
  suggestions:      Suggestion[];
  campaign:         Campaign | null;
  periodStats:      PeriodStats | null;
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
  campaign,
  periodStats,
}: Props) {
  const [localSuggestions, setLocalSuggestions] = useState(suggestions);
  const [approving, setApproving]   = useState<string | null>(null);
  const [syncing, setSyncing]       = useState(false);

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

  async function handleDismissSuggestion(id: string) {
    try {
      await fetch(`/api/suggestions/${id}/dismiss`, { method: "POST" });
      setLocalSuggestions((prev) => prev.filter((s) => s.id !== id));
    } catch {
      toast({ title: "Erro ao dispensar", variant: "destructive" });
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
                          className="flex items-center gap-4 px-4 py-3 hover:bg-surface-800/50 transition-colors"
                        >
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
