"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBRL, formatTime, formatDate, relativeTime } from "@/lib/utils";
import { Loader2, Phone, Clock, User, Scissors, CalendarClock } from "lucide-react";
import type { AgendaAppointment } from "../agenda-client";

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED:   "Agendado",
  CONFIRMED:   "Confirmado",
  IN_PROGRESS: "Em atendimento",
  COMPLETED:   "Concluído",
  CANCELLED:   "Cancelado",
  NO_SHOW:     "Não compareceu",
};

const STATUS_NEXT: Record<string, { label: string; status: string; variant: "default" | "destructive" | "outline" | "secondary" | "success" | "warning" }[]> = {
  SCHEDULED:   [
    { label: "Confirmar",       status: "CONFIRMED",   variant: "success" },
    { label: "Cancelar",        status: "CANCELLED",   variant: "destructive" },
  ],
  CONFIRMED:   [
    { label: "Iniciar",         status: "IN_PROGRESS", variant: "warning" },
    { label: "Cancelar",        status: "CANCELLED",   variant: "destructive" },
  ],
  IN_PROGRESS: [
    { label: "Concluir",        status: "COMPLETED",   variant: "success" },
    { label: "Não compareceu",  status: "NO_SHOW",     variant: "outline" },
  ],
  COMPLETED:   [],
  CANCELLED:   [{ label: "Reagendar", status: "__reschedule__", variant: "outline" }],
  NO_SHOW:     [{ label: "Reagendar", status: "__reschedule__", variant: "outline" }],
};

interface CustomerContext {
  id: string;
  name: string;
  phone?: string | null;
  postSaleStatus?: string | null;
  lastCompletedAppointmentAt?: string | null;
  lastServiceSummary?: string | null;
  lastSpentAmount?: number | null;
  totalSpentLast60d?: number | null;
  visitsLast60d?: number | null;
  avgTicketLast60d?: number | null;
  totalVisits?: number;
  totalSpent?: number;
  avgTicket?: number;
}

interface RecentAppt {
  id: string;
  scheduledAt: string;
  price?: number | null;
  serviceName?: string | null;
}

interface Props {
  appointment: AgendaAppointment | null;
  open: boolean;
  onClose: () => void;
  onStatusChange: (appointmentId: string, newStatus: string) => void;
  onReschedule: (appointmentId: string, scheduledAt: string) => void;
}

export function AppointmentDrawer({ appointment, open, onClose, onStatusChange, onReschedule }: Props) {
  const [context, setContext]             = useState<{ customer: CustomerContext | null; recentAppointments: RecentAppt[] } | null>(null);
  const [loadingCtx, setLoadingCtx]       = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [rescheduling, setRescheduling]   = useState(false);
  const [newDate, setNewDate]             = useState("");
  const [newTime, setNewTime]             = useState("");
  const todayIso = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!appointment || !open) { setContext(null); return; }
    setLoadingCtx(true);
    fetch(`/api/appointments/${appointment.id}/customer-context`)
      .then((r) => r.json())
      .then((d) => setContext(d))
      .catch(() => setContext(null))
      .finally(() => setLoadingCtx(false));
  }, [appointment?.id, open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleStatus(status: string) {
    if (!appointment) return;
    if (status === "__reschedule__") { setRescheduling(true); return; }
    setUpdatingStatus(true);
    try {
      await fetch(`/api/appointments/${appointment.id}/status`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status }),
      });
      onStatusChange(appointment.id, status);
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleReschedule() {
    if (!appointment || !newDate || !newTime) return;
    const scheduledAt = new Date(`${newDate}T${newTime}`).toISOString();
    if (new Date(scheduledAt) <= new Date()) return; // silently blocked by min attribute
    setUpdatingStatus(true);
    try {
      await fetch(`/api/appointments/${appointment.id}/reschedule`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ scheduledAt }),
      });
      onReschedule(appointment.id, scheduledAt);
      setRescheduling(false);
    } finally {
      setUpdatingStatus(false);
    }
  }

  if (!appointment) return null;

  const actions = STATUS_NEXT[appointment.status] ?? [];
  const customer = context?.customer ?? null;
  const recent   = context?.recentAppointments ?? [];

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto">
        {/* Header */}
        <SheetHeader>
          <SheetTitle className="pr-8">{appointment.customerName}</SheetTitle>
          <SheetDescription className="flex flex-wrap gap-2 items-center">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTime(appointment.scheduledAt)} · {appointment.durationMin}min
            </span>
            {appointment.serviceName && (
              <span className="flex items-center gap-1">
                <Scissors className="h-3 w-3" />
                {appointment.serviceName}
              </span>
            )}
            {appointment.profissional && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {appointment.profissional}
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="px-6 pb-6 space-y-5 mt-4">
          {/* Status + Actions */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Status</span>
              <Badge variant={statusVariant(appointment.status) as any}>
                {STATUS_LABELS[appointment.status] ?? appointment.status}
              </Badge>
              {appointment.price && (
                <span className="ml-auto text-sm font-semibold text-foreground">{formatBRL(appointment.price)}</span>
              )}
            </div>
            {actions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {actions.map((a) => (
                  <Button
                    key={a.status}
                    size="sm"
                    variant={a.variant as any}
                    disabled={updatingStatus}
                    onClick={() => handleStatus(a.status)}
                  >
                    {updatingStatus ? <Loader2 className="h-3 w-3 animate-spin" /> : a.label}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Reschedule form */}
          {rescheduling && (
            <div className="rounded-lg border border-border/60 bg-surface-800 p-3 space-y-3">
              <p className="text-xs font-medium text-foreground flex items-center gap-1">
                <CalendarClock className="h-3.5 w-3.5" /> Reagendar
              </p>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={newDate}
                  min={todayIso}
                  onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="flex-1 rounded border border-border bg-surface-900 px-2 py-1 text-sm text-foreground cursor-pointer"
                />
                <input
                  type="time"
                  value={newTime}
                  onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-28 rounded border border-border bg-surface-900 px-2 py-1 text-sm text-foreground cursor-pointer"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleReschedule} disabled={!newDate || !newTime || updatingStatus}>
                  {updatingStatus ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirmar"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRescheduling(false)}>Cancelar</Button>
              </div>
            </div>
          )}

          {/* Customer summary */}
          <section className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Resumo do cliente</h3>
            {loadingCtx ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Carregando...
              </div>
            ) : customer ? (
              <div className="rounded-lg border border-border/60 bg-surface-800 divide-y divide-border/40">
                {customer.phone && (
                  <Row icon={<Phone className="h-3.5 w-3.5" />} label="Telefone" value={customer.phone} />
                )}
                {customer.lastCompletedAppointmentAt && (
                  <Row label="Última visita" value={relativeTime(customer.lastCompletedAppointmentAt)} />
                )}
                {customer.lastServiceSummary && (
                  <Row label="Último serviço" value={customer.lastServiceSummary} />
                )}
                {customer.lastSpentAmount != null && (
                  <Row label="Último gasto" value={formatBRL(customer.lastSpentAmount)} />
                )}
                {customer.visitsLast60d != null && (
                  <Row label="Visitas (60d)" value={String(customer.visitsLast60d)} />
                )}
                {customer.totalSpentLast60d != null && (
                  <Row label="Gasto (60d)" value={formatBRL(customer.totalSpentLast60d)} />
                )}
                {customer.avgTicketLast60d != null && (
                  <Row label="Ticket médio (60d)" value={formatBRL(customer.avgTicketLast60d)} />
                )}
                {customer.totalVisits != null && (
                  <Row label="Total de visitas" value={String(customer.totalVisits)} />
                )}
                {customer.postSaleStatus && (
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs text-muted-foreground">Status pós-venda</span>
                    <Badge variant="outline" className="text-[10px]">{customer.postSaleStatus}</Badge>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sem dados do cliente.</p>
            )}
          </section>

          {/* Recent history */}
          {recent.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Últimas visitas</h3>
              <div className="rounded-lg border border-border/60 bg-surface-800 divide-y divide-border/40">
                {recent.map((r) => (
                  <div key={r.id} className="flex items-center justify-between px-3 py-2">
                    <div>
                      <p className="text-xs text-foreground">{r.serviceName ?? "—"}</p>
                      <p className="text-[11px] text-muted-foreground">{formatDate(r.scheduledAt, { day: "2-digit", month: "2-digit", year: "2-digit" })}</p>
                    </div>
                    {r.price != null && (
                      <span className="text-xs font-medium text-foreground">{formatBRL(r.price)}</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        {icon}{label}
      </span>
      <span className="text-xs font-medium text-foreground">{value}</span>
    </div>
  );
}

function statusVariant(status: string) {
  switch (status) {
    case "SCHEDULED":   return "default";
    case "CONFIRMED":   return "success";
    case "IN_PROGRESS": return "warning";
    case "COMPLETED":   return "secondary";
    case "CANCELLED":   return "destructive";
    case "NO_SHOW":     return "outline";
    default:            return "default";
  }
}
