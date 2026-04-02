"use client";

import { formatTime, formatBRL } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { AgendaAppointment } from "../agenda-client";

const STATUS_COLOR: Record<string, string> = {
  SCHEDULED:   "bg-blue-500/15 border-blue-500/40 hover:bg-blue-500/25",
  CONFIRMED:   "bg-emerald-500/15 border-emerald-500/40 hover:bg-emerald-500/25",
  IN_PROGRESS: "bg-amber-500/15 border-amber-500/40 hover:bg-amber-500/25",
  COMPLETED:   "bg-muted/40 border-border/40 hover:bg-muted/60",
  CANCELLED:   "bg-red-500/10 border-red-500/20 opacity-60",
  NO_SHOW:     "bg-orange-500/10 border-orange-500/20 opacity-60",
};

const STATUS_BADGE: Record<string, string> = {
  SCHEDULED:   "default",
  CONFIRMED:   "success",
  IN_PROGRESS: "warning",
  COMPLETED:   "secondary",
  CANCELLED:   "destructive",
  NO_SHOW:     "outline",
};

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED:   "Agendado",
  CONFIRMED:   "Confirmado",
  IN_PROGRESS: "Em atend.",
  COMPLETED:   "Concluído",
  CANCELLED:   "Cancelado",
  NO_SHOW:     "No-show",
};

// Hours 08:00–20:00 in 30-min slots
const HOURS = Array.from({ length: 25 }, (_, i) => {
  const total = 8 * 60 + i * 30;
  const h = Math.floor(total / 60).toString().padStart(2, "0");
  const m = (total % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
});

interface Props {
  appointments: AgendaAppointment[];
  onSelect: (appt: AgendaAppointment) => void;
}

export function AgendaTimeline({ appointments, onSelect }: Props) {
  // Group by profissional
  const professionals = Array.from(
    new Set(appointments.map((a) => a.profissional ?? "Sem profissional"))
  );

  // Build lookup: "profissional-HH:MM" → appointment
  const slotMap = new Map<string, AgendaAppointment>();
  for (const a of appointments) {
    const time = formatTime(a.scheduledAt);
    const key  = `${a.profissional ?? "Sem profissional"}-${time}`;
    slotMap.set(key, a);
  }

  const hasPros = professionals.length > 0;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header row with professional names */}
      {hasPros && (
        <div
          className="grid border-b border-border bg-surface-800/50"
          style={{ gridTemplateColumns: `80px repeat(${professionals.length}, 1fr)` }}
        >
          <div className="px-3 py-2 text-[11px] text-muted-foreground uppercase tracking-wide">Horário</div>
          {professionals.map((p) => (
            <div key={p} className="px-3 py-2 text-xs font-medium text-foreground border-l border-border truncate">{p}</div>
          ))}
        </div>
      )}

      {/* Time rows */}
      <div className="divide-y divide-border/40 overflow-y-auto max-h-[70vh]">
        {HOURS.map((slot) => {
          const rowAppts = hasPros
            ? professionals.map((p) => slotMap.get(`${p}-${slot}`) ?? null)
            : [appointments.find((a) => formatTime(a.scheduledAt) === slot) ?? null];

          const hasAny = rowAppts.some(Boolean);

          return (
            <div
              key={slot}
              className={`grid items-start min-h-[48px] ${!hasAny ? "opacity-60" : ""}`}
              style={{ gridTemplateColumns: hasPros ? `80px repeat(${professionals.length}, 1fr)` : "80px 1fr" }}
            >
              {/* Time label */}
              <div className="px-3 py-2 text-xs text-muted-foreground tabular-nums self-center">{slot}</div>

              {rowAppts.map((appt, i) => (
                <div key={i} className="border-l border-border/30 px-2 py-1.5 min-h-[48px]">
                  {appt ? (
                    <button
                      onClick={() => onSelect(appt)}
                      className={`w-full text-left rounded border px-2 py-1.5 transition-colors ${STATUS_COLOR[appt.status] ?? "bg-muted/20 border-border/40"} ${appt.status === "CANCELLED" ? "cursor-default" : "cursor-pointer"}`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0">
                          <p className={`text-xs font-medium text-foreground truncate ${appt.status === "CANCELLED" ? "line-through text-muted-foreground" : ""}`}>
                            {appt.customerName}
                          </p>
                          {appt.serviceName && (
                            <p className="text-[11px] text-muted-foreground truncate">{appt.serviceName}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-0.5 shrink-0">
                          <Badge variant={STATUS_BADGE[appt.status] as any} className="text-[9px] px-1 py-0">
                            {STATUS_LABELS[appt.status] ?? appt.status}
                          </Badge>
                          {appt.price != null && (
                            <span className="text-[10px] text-muted-foreground tabular-nums">{formatBRL(appt.price)}</span>
                          )}
                        </div>
                      </div>
                      {appt.durationMin > 30 && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">{appt.durationMin}min</p>
                      )}
                    </button>
                  ) : (
                    <div className="h-full" />
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
