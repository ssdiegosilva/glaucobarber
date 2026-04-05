"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { AgendaKPICards } from "./components/AgendaKPICards";
import { AgendaTimeline } from "./components/AgendaTimeline";
import { AppointmentDrawer } from "./components/AppointmentDrawer";
import { NewAppointmentDrawer } from "./components/NewAppointmentDrawer";
import { MonthlyOverview } from "./components/MonthlyOverview";
import { DayOffScreen } from "./components/DayOffScreen";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, Settings2, ChevronLeft, ChevronRight, CalendarDays, BarChart3, Clock, Users } from "lucide-react";
import type { AgendaKPIs } from "./components/AgendaKPICards";

export interface AgendaAppointment {
  id:            string;
  trinksId?:     string | null;
  customerName:  string;
  serviceName?:  string | null;
  scheduledAt:   string;   // ISO string
  durationMin:   number;
  status:        string;
  price?:        number | null;
  profissional?: string | null;
  barberId?:     string | null;
  notes?:        string | null;
}

export interface BarberOption {
  id:   string;
  name: string;
  role: string;
}

interface Props {
  appointments:    AgendaAppointment[];
  barbers:         BarberOption[];
  kpis:            AgendaKPIs;
  date:            string;   // formatted label e.g. "quinta-feira, 02 de abril"
  dateIso:         string;   // YYYY-MM-DD for the input
  hasTrinks:       boolean;
  agendaStartHour: number;
  agendaEndHour:   number;
  currentYear:     number;
  isDayOff:        boolean;
}

const TOTAL_SLOTS = 20;

export function AgendaClient({
  appointments: initial, barbers, kpis, date, dateIso, hasTrinks,
  agendaStartHour: initStart, agendaEndHour: initEnd, currentYear, isDayOff,
}: Props) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const [tab, setTab]                   = useState<"day" | "months">("day");
  const [appointments, setAppointments] = useState(initial);
  const [selectedAppt, setSelectedAppt] = useState<AgendaAppointment | null>(null);
  const [drawerOpen, setDrawerOpen]     = useState(false);
  const [newApptSlot, setNewApptSlot]   = useState<{ date: string; time: string; profissional: string; barberId?: string } | null>(null);
  const [filterBarberId, setFilterBarberId] = useState<string>("all");
  const [syncing, startSync]            = useTransition();
  const [startHour, setStartHour]       = useState(initStart);
  const [endHour, setEndHour]           = useState(initEnd);
  const [savingRange, setSavingRange]   = useState(false);

  // Sync appointments when server re-renders with new data (day change)
  useEffect(() => { setAppointments(initial); }, [initial]);

  // ── Day navigation ────────────────────────────────────

  function navigateDay(offsetDays: number) {
    const d = new Date(dateIso);
    d.setDate(d.getDate() + offsetDays);
    const newDate = d.toISOString().split("T")[0];
    const params  = new URLSearchParams(searchParams.toString());
    params.set("date", newDate);
    params.delete("tab"); // stay on day tab
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleDatePick(val: string) {
    if (!val) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", val);
    router.push(`${pathname}?${params.toString()}`);
  }

  // ── Appointment actions ───────────────────────────────

  function openDrawer(appt: AgendaAppointment) {
    setSelectedAppt(appt);
    setDrawerOpen(true);
  }

  function handleStatusChange(appointmentId: string, newStatus: string) {
    setAppointments((prev) => prev.map((a) => (a.id === appointmentId ? { ...a, status: newStatus } : a)));
    setSelectedAppt((prev) => (prev?.id === appointmentId ? { ...prev, status: newStatus } : prev));
  }

  function handleReschedule(appointmentId: string, scheduledAt: string) {
    setAppointments((prev) => prev.map((a) => (a.id === appointmentId ? { ...a, scheduledAt, status: "SCHEDULED" } : a)));
    setSelectedAppt((prev) => (prev?.id === appointmentId ? { ...prev, scheduledAt, status: "SCHEDULED" } : prev));
  }

  function handleSlotClick(isoTime: string, profissional: string, barberId?: string) {
    // isoTime is like "2025-04-02T14:00:00.000Z" — parse in local time
    const d    = new Date(isoTime);
    const date = dateIso; // use the current agenda date, not UTC
    const hh   = d.getUTCHours().toString().padStart(2, "0");
    const mm   = d.getUTCMinutes().toString().padStart(2, "0");
    setNewApptSlot({ date, time: `${hh}:${mm}`, profissional, barberId });
  }

  function handleNewApptCreated(appt: AgendaAppointment) {
    setAppointments((prev) => [...prev, appt]);
  }

  // ── Sync ─────────────────────────────────────────────

  function handleSync() {
    startSync(async () => {
      await fetch("/api/trinks/sync", { method: "POST" });
      router.refresh();
    });
  }

  // ── Agenda range ─────────────────────────────────────

  async function saveRange(newStart: number, newEnd: number) {
    if (newEnd <= newStart) return;
    setSavingRange(true);
    try {
      await fetch("/api/barbershop/agenda-settings", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ agendaStartHour: newStart, agendaEndHour: newEnd }),
      });
    } finally {
      setSavingRange(false);
    }
  }

  function handleStartChange(val: number) {
    const v = Math.max(0, Math.min(val, endHour - 1));
    setStartHour(v);
    saveRange(v, endHour);
  }

  function handleEndChange(val: number) {
    const v = Math.max(startHour + 1, Math.min(val, 24));
    setEndHour(v);
    saveRange(startHour, v);
  }

  // ── Live KPIs (update when status changes) ────────────

  // ── Past date detection ────────────────────────────────
  const todayStr = new Date().toISOString().split("T")[0];
  const isPastDate = dateIso < todayStr;

  // Filter appointments by barber
  const filteredAppointments = filterBarberId === "all"
    ? appointments
    : appointments.filter((a) => a.barberId === filterBarberId);

  const liveKpis: AgendaKPIs = {
    revenueCompleted: filteredAppointments.filter((a) => a.status === "COMPLETED").reduce((s, a) => s + (a.price ?? 0), 0),
    revenueProjected: filteredAppointments.filter((a) => ["SCHEDULED","CONFIRMED","IN_PROGRESS"].includes(a.status)).reduce((s, a) => s + (a.price ?? 0), 0),
    completedCount:   filteredAppointments.filter((a) => a.status === "COMPLETED").length,
    cancelledCount:   filteredAppointments.filter((a) => a.status === "CANCELLED").length,
    noShowCount:      filteredAppointments.filter((a) => a.status === "NO_SHOW").length,
    occupancyRate:    Math.min(filteredAppointments.filter((a) => !["CANCELLED","NO_SHOW"].includes(a.status)).length / TOTAL_SLOTS, 1),
    freeSlots:        Math.max(TOTAL_SLOTS - filteredAppointments.filter((a) => !["CANCELLED","NO_SHOW"].includes(a.status)).length, 0),
    totalSlots:       TOTAL_SLOTS,
  };

  return (
    <div className="space-y-4">
      {/* ── Tab bar ─────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setTab("day")}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
              tab === "day"
                ? "bg-gold-500/15 text-gold-400 border-r border-border"
                : "text-muted-foreground hover:text-foreground border-r border-border"
            }`}
          >
            <CalendarDays className="h-4 w-4" /> Dia
          </button>
          <button
            onClick={() => setTab("months")}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
              tab === "months"
                ? "bg-gold-500/15 text-gold-400"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BarChart3 className="h-4 w-4" /> Meses
          </button>
        </div>

        {tab === "day" && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Range picker */}
            <div className="flex items-center gap-2 rounded-md border border-border/60 bg-surface-900 px-3 py-1.5 text-xs">
              <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Das</span>
              <select
                value={startHour}
                onChange={(e) => handleStartChange(Number(e.target.value))}
                disabled={savingRange}
                className="bg-transparent text-foreground focus:outline-none"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{i.toString().padStart(2, "0")}:00</option>
                ))}
              </select>
              <span className="text-muted-foreground">às</span>
              <select
                value={endHour}
                onChange={(e) => handleEndChange(Number(e.target.value))}
                disabled={savingRange}
                className="bg-transparent text-foreground focus:outline-none"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{(i + 1).toString().padStart(2, "0")}:00</option>
                ))}
              </select>
              {savingRange && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>

            {hasTrinks && (
              <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing}>
                {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                <span className="ml-1.5">Sincronizar</span>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── Day tab ─────────────────────────────────────── */}
      {tab === "day" && (
        <>
          {/* Day navigation */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => navigateDay(-1)}
              className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-800 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-medium text-foreground capitalize">{date}</p>
            {isPastDate && (
              <span className="flex items-center gap-1 rounded-full bg-red-500/15 border border-red-500/30 px-2 py-0.5 text-[11px] font-medium text-red-400">
                <Clock className="h-3 w-3" />
                Data passada
              </span>
            )}
            <button
              onClick={() => navigateDay(1)}
              className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-800 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <input
              type="date"
              value={dateIso}
              onChange={(e) => handleDatePick(e.target.value)}
              className="rounded-md border border-border bg-surface-900 px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />

            {barbers.length > 1 && (
              <div className="flex items-center gap-2 rounded-md border border-border/60 bg-surface-900 px-3 py-1.5 text-xs">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <select
                  value={filterBarberId}
                  onChange={(e) => setFilterBarberId(e.target.value)}
                  className="bg-transparent text-foreground focus:outline-none"
                >
                  <option value="all">Todos os barbeiros</option>
                  {barbers.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {isDayOff ? (
            <DayOffScreen dateIso={dateIso} dateLabel={date} />
          ) : (
            <>
              <AgendaKPICards kpis={liveKpis} />

              <AgendaTimeline
                appointments={filteredAppointments}
                barbers={barbers}
                onSelect={openDrawer}
                onSlotClick={handleSlotClick}
                dateIso={dateIso}
                startHour={startHour}
                endHour={endHour}
              />

              {appointments.length === 0 && (
                <p className="text-center text-sm text-muted-foreground -mt-2">
                  Nenhum agendamento para este dia. Clique em um horário para agendar.
                </p>
              )}

              <AppointmentDrawer
                appointment={selectedAppt}
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                onStatusChange={handleStatusChange}
                onReschedule={handleReschedule}
              />

              <NewAppointmentDrawer
                open={newApptSlot !== null}
                onClose={() => setNewApptSlot(null)}
                defaultDate={newApptSlot?.date ?? dateIso}
                defaultTime={newApptSlot?.time ?? "09:00"}
                defaultProfissional={newApptSlot?.profissional}
                defaultBarberId={newApptSlot?.barberId}
                barbers={barbers}
                onCreated={handleNewApptCreated}
              />
            </>
          )}
        </>
      )}

      {/* ── Months tab ──────────────────────────────────── */}
      {tab === "months" && (
        <MonthlyOverview initialYear={currentYear} />
      )}
    </div>
  );
}
