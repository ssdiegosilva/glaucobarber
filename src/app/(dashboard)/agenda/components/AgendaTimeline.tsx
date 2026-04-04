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

// ── Overlap detection ─────────────────────────────────────
// For each professional, assigns each appointment to a sub-column
// so that overlapping appointments appear side-by-side.

interface PlacedAppt {
  appt:      AgendaAppointment;
  subCol:    number;   // 0-indexed within this professional
  totalSubs: number;   // total sub-columns needed for this professional
}

function placeAppointments(appts: AgendaAppointment[]): PlacedAppt[] {
  // Sort by start time
  const sorted = [...appts].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  );

  // Track end time (in ms) of the last appointment in each sub-column
  const subColEnds: number[] = [];
  const assignments = new Map<string, number>(); // apptId → subCol index

  for (const appt of sorted) {
    const startMs = new Date(appt.scheduledAt).getTime();
    const endMs   = startMs + appt.durationMin * 60_000;

    // Find first sub-column that is free at startMs
    let assigned = -1;
    for (let i = 0; i < subColEnds.length; i++) {
      if (subColEnds[i] <= startMs) {
        assigned     = i;
        subColEnds[i] = endMs;
        break;
      }
    }
    if (assigned === -1) {
      assigned = subColEnds.length;
      subColEnds.push(endMs);
    }
    assignments.set(appt.id, assigned);
  }

  const totalSubs = Math.max(subColEnds.length, 1);

  return sorted.map((appt) => ({
    appt,
    subCol:    assignments.get(appt.id) ?? 0,
    totalSubs,
  }));
}

// ── Grid helpers ──────────────────────────────────────────

function buildTimeLabels(startHour: number, endHour: number) {
  const startMin  = startHour * 60;
  const endMin    = endHour   * 60;
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
  const d       = new Date(isoString);
  const minutes = d.getHours() * 60 + d.getMinutes();
  return Math.floor((minutes - startHour * 60) / SLOT_MINUTES) + 1;
}

function durationToRowSpan(durationMin: number): number {
  return Math.max(1, Math.ceil(durationMin / SLOT_MINUTES));
}

// ── Mobile tap-vs-scroll guard ────────────────────────────
// Tracks pointer-down position so we can ignore onPointerUp when
// the user was actually scrolling (moved > 20 px).
// -9999 sentinel = cancelled (browser took over scroll).
let _ptrStartX = -9999;
let _ptrStartY = -9999;

// ── Component ─────────────────────────────────────────────

interface Props {
  appointments:  AgendaAppointment[];
  onSelect:      (appt: AgendaAppointment) => void;
  onSlotClick?:  (isoTime: string, profissional: string) => void;
  /** ISO date string YYYY-MM-DD for the currently displayed day */
  dateIso?:      string;
  startHour?:    number;
  endHour?:      number;
}

export function AgendaTimeline({ appointments, onSelect, onSlotClick, dateIso, startHour = 6, endHour = 24 }: Props) {
  const { labels: timeLabels, totalRows } = buildTimeLabels(startHour, endHour);

  // Group appointments by professional
  const professionals = Array.from(
    new Set(appointments.map((a) => a.profissional ?? "Sem profissional"))
  );

  // For each professional, detect overlaps and get sub-column placement
  const placedByPro = new Map<string, PlacedAppt[]>();
  for (const pro of professionals) {
    const proAppts = appointments.filter((a) => (a.profissional ?? "Sem profissional") === pro);
    placedByPro.set(pro, placeAppointments(proAppts));
  }

  // Build CSS grid columns:
  // col 1 = time labels
  // for each professional: totalSubs sub-columns (each 1fr)
  const proSubCols = professionals.map((p) => {
    const placed = placedByPro.get(p)!;
    return placed.length > 0 ? placed[0].totalSubs : 1;
  });

  // column index offset per professional (1-based, after the time label col)
  const proColOffset: number[] = [];
  let offset = 2; // col 1 is time labels, professionals start at col 2
  for (const subs of proSubCols) {
    proColOffset.push(offset);
    offset += subs;
  }

  const totalGridCols = 1 + proSubCols.reduce((s, n) => s + n, 0);
  const gridCols = `80px repeat(${totalGridCols - 1}, 1fr)`;
  const gridRows = `repeat(${totalRows}, ${ROW_HEIGHT_PX}px)`;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Sticky header */}
      <div
        className="grid border-b border-border bg-surface-800/60 sticky top-0 z-10"
        style={{ gridTemplateColumns: gridCols }}
      >
        <div className="px-3 py-2.5 text-[11px] text-muted-foreground uppercase tracking-wide">Horário</div>
        {professionals.map((p, pIdx) => (
          <div
            key={p}
            className="px-3 py-2.5 text-xs font-medium text-foreground border-l border-border truncate"
            style={{ gridColumn: `${proColOffset[pIdx]} / span ${proSubCols[pIdx]}` }}
          >
            {p}
          </div>
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

          {/* Grid background cells — clickable to create new appointments */}
          {Array.from({ length: totalRows }, (_, rowIdx) =>
            Array.from({ length: totalGridCols - 1 }, (_, colIdx) => {
              // Map colIdx back to professional name for slot click
              const proForCol = (() => {
                let cumulative = 0;
                for (let p = 0; p < professionals.length; p++) {
                  const subs = proSubCols[p];
                  if (colIdx < cumulative + subs) return professionals[p];
                  cumulative += subs;
                }
                return professionals[0] ?? "Sem profissional";
              })();

              function fireSlotClick() {
                const totalMin = (startHour * 60) + rowIdx * SLOT_MINUTES;
                const h = Math.floor(totalMin / 60) % 24;
                const m = totalMin % 60;
                const hh = h.toString().padStart(2, "0");
                const mm = m.toString().padStart(2, "0");
                const day = dateIso ?? new Date().toISOString().split("T")[0];
                onSlotClick!(`${day}T${hh}:${mm}:00.000Z`, proForCol);
              }

              return (
                <div
                  key={`bg-${rowIdx}-${colIdx}`}
                  onPointerDown={onSlotClick ? (e) => { _ptrStartX = e.clientX; _ptrStartY = e.clientY; } : undefined}
                  onPointerCancel={onSlotClick ? () => { _ptrStartX = -9999; _ptrStartY = -9999; } : undefined}
                  onPointerUp={onSlotClick ? (e) => {
                    if (Math.abs(e.clientX - _ptrStartX) > 20 || Math.abs(e.clientY - _ptrStartY) > 20) return;
                    _ptrStartX = -9999; _ptrStartY = -9999;
                    fireSlotClick();
                  } : undefined}
                  className={`border-b border-l border-border/20 group relative
                    ${onSlotClick ? "cursor-pointer hover:bg-gold-500/5" : ""}`}
                  style={{
                    gridColumn: colIdx + 2,
                    gridRow: rowIdx + 1,
                    touchAction: onSlotClick ? "manipulation" : undefined,
                  }}
                >
                  {onSlotClick && (
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] text-gold-400/0 group-hover:text-gold-400/50 transition-colors select-none pointer-events-none">
                      +
                    </span>
                  )}
                </div>
              );
            })
          )}

          {/* Appointments */}
          {professionals.flatMap((pro, pIdx) => {
            const placed = placedByPro.get(pro) ?? [];
            return placed.map(({ appt, subCol }) => {
              const rowStart = timeToRow(appt.scheduledAt, startHour);
              const rowSpan  = durationToRowSpan(appt.durationMin);
              const rowEnd   = rowStart + rowSpan;

              if (rowStart < 1 || rowStart > totalRows) return null;

              const colIndex = proColOffset[pIdx] + subCol;
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
            });
          })}
        </div>
      </div>
    </div>
  );
}
