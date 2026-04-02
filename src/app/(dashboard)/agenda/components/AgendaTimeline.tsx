"use client";

import { formatBRL } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { AgendaAppointment } from "../agenda-client";

const STATUS_COLOR: Record<string, string> = {
  SCHEDULED:   "bg-blue-500/15 border-blue-500/40 hover:bg-blue-500/25",
  CONFIRMED:   "bg-emerald-500/15 border-emerald-500/40 hover:bg-emerald-500/25",
  IN_PROGRESS: "bg-amber-500/15 border-amber-500/40 hover:bg-amber-500/25",
  COMPLETED:   "bg-muted/40 border-border/40 hover:bg-muted/60",
  CANCELLED:   "bg-red-500/10 border-red-500/20 opacity-50",
  NO_SHOW:     "bg-orange-500/10 border-orange-500/20 opacity-50",
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

const SLOT_MINUTES  = 30;
const ROW_HEIGHT_PX = 52;

function buildTimeLabels(startHour: number, endHour: number) {
  const startMin = startHour * 60;
  const endMin   = endHour   * 60;
  const totalRows = (endMin - startMin) / SLOT_MINUTES;
  const labels: string[] = [];
  for (let i = 0; i <= totalRows; i++) {
    const total = startMin + i * SLOT_MINUTES;
    const h = Math.floor(total / 60) % 24;
    const m = total % 60;
    labels.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
  }
  return { labels, totalRows };
}

function timeToRow(isoString: string, startHour: number): number {
  const d = new Date(isoString);
  const minutes = d.getHours() * 60 + d.getMinutes();
  return Math.floor((minutes - startHour * 60) / SLOT_MINUTES) + 1;
}

function durationToRowSpan(durationMin: number): number {
  return Math.max(1, Math.ceil(durationMin / SLOT_MINUTES));
}

interface Props {
  appointments: AgendaAppointment[];
  onSelect:     (appt: AgendaAppointment) => void;
  startHour?:   number;
  endHour?:     number;
}

export function AgendaTimeline({ appointments, onSelect, startHour = 6, endHour = 24 }: Props) {
  const { labels: timeLabels, totalRows } = buildTimeLabels(startHour, endHour);

  const professionals = Array.from(
    new Set(appointments.map((a) => a.profissional ?? "Sem profissional"))
  );
  const numCols  = Math.max(professionals.length, 1);
  const gridCols = `80px repeat(${numCols}, 1fr)`;
  const gridRows = `repeat(${totalRows}, ${ROW_HEIGHT_PX}px)`;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Sticky header */}
      <div
        className="grid border-b border-border bg-surface-800/60 sticky top-0 z-10"
        style={{ gridTemplateColumns: gridCols }}
      >
        <div className="px-3 py-2.5 text-[11px] text-muted-foreground uppercase tracking-wide">Horário</div>
        {professionals.map((p) => (
          <div key={p} className="px-3 py-2.5 text-xs font-medium text-foreground border-l border-border truncate">{p}</div>
        ))}
      </div>

      {/* Scrollable grid body */}
      <div className="overflow-y-auto" style={{ maxHeight: "70vh" }}>
        <div className="grid relative" style={{ gridTemplateColumns: gridCols, gridTemplateRows: gridRows }}>

          {/* Time labels (col 1) */}
          {timeLabels.map((label, i) => (
            <div
              key={label}
              className="px-3 flex items-start pt-1 border-b border-border/30"
              style={{ gridColumn: 1, gridRow: i + 1 }}
            >
              <span className="text-xs text-muted-foreground tabular-nums">{label}</span>
            </div>
          ))}

          {/* Grid lines */}
          {Array.from({ length: totalRows }, (_, i) =>
            professionals.map((_, pIdx) => (
              <div
                key={`cell-${i}-${pIdx}`}
                className="border-b border-l border-border/20"
                style={{ gridColumn: pIdx + 2, gridRow: i + 1 }}
              />
            ))
          )}

          {/* Appointments */}
          {appointments.map((appt) => {
            const profIdx  = professionals.indexOf(appt.profissional ?? "Sem profissional");
            const colIndex = profIdx === -1 ? 2 : profIdx + 2;
            const rowStart = timeToRow(appt.scheduledAt, startHour);
            const rowSpan  = durationToRowSpan(appt.durationMin);
            const rowEnd   = rowStart + rowSpan;

            if (rowStart < 1 || rowStart > totalRows) return null;

            const endTime  = new Date(new Date(appt.scheduledAt).getTime() + appt.durationMin * 60_000);
            const endLabel = `${(endTime.getHours() % 24).toString().padStart(2, "0")}:${endTime.getMinutes().toString().padStart(2, "0")}`;

            return (
              <div
                key={appt.id}
                className="px-1 py-0.5"
                style={{ gridColumn: colIndex, gridRow: `${rowStart} / ${rowEnd}`, zIndex: 2 }}
              >
                <button
                  onClick={() => onSelect(appt)}
                  className={`w-full h-full text-left rounded border px-2 py-1.5 transition-colors overflow-hidden flex flex-col justify-between
                    ${STATUS_COLOR[appt.status] ?? "bg-muted/20 border-border/40"}
                    ${appt.status === "CANCELLED" ? "cursor-default" : "cursor-pointer"}`}
                >
                  <div className="flex items-start justify-between gap-1 min-w-0">
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-semibold text-foreground truncate leading-tight
                        ${appt.status === "CANCELLED" ? "line-through text-muted-foreground" : ""}`}>
                        {appt.customerName}
                      </p>
                      {appt.serviceName && (
                        <p className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                          {appt.serviceName}
                        </p>
                      )}
                    </div>
                    <Badge variant={STATUS_BADGE[appt.status] as any} className="text-[9px] px-1 py-0 shrink-0 leading-tight">
                      {STATUS_LABELS[appt.status] ?? appt.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {appt.durationMin}min · até {endLabel}
                    </span>
                    {appt.price != null && (
                      <span className="text-[10px] font-medium text-foreground tabular-nums">{formatBRL(appt.price)}</span>
                    )}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
