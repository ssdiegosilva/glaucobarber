"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AgendaKPICards } from "./components/AgendaKPICards";
import { AgendaTimeline } from "./components/AgendaTimeline";
import { AppointmentDrawer } from "./components/AppointmentDrawer";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import type { AgendaKPIs } from "./components/AgendaKPICards";

export interface AgendaAppointment {
  id:           string;
  trinksId?:    string | null;
  customerName: string;
  serviceName?: string | null;
  scheduledAt:  string;   // ISO string
  durationMin:  number;
  status:       string;
  price?:       number | null;
  profissional?: string | null;
  notes?:       string | null;
}

interface Props {
  appointments: AgendaAppointment[];
  kpis:         AgendaKPIs;
  date:         string;  // dd/MM/yyyy
  hasTrinks:    boolean;
}

export function AgendaClient({ appointments: initial, kpis: initialKpis, date, hasTrinks }: Props) {
  const router = useRouter();
  const [appointments, setAppointments] = useState(initial);
  const [selectedAppt, setSelectedAppt] = useState<AgendaAppointment | null>(null);
  const [drawerOpen, setDrawerOpen]     = useState(false);
  const [syncing, startSync]            = useTransition();

  function openDrawer(appt: AgendaAppointment) {
    setSelectedAppt(appt);
    setDrawerOpen(true);
  }

  function handleStatusChange(appointmentId: string, newStatus: string) {
    setAppointments((prev) =>
      prev.map((a) => (a.id === appointmentId ? { ...a, status: newStatus } : a))
    );
    if (selectedAppt?.id === appointmentId) {
      setSelectedAppt((prev) => prev ? { ...prev, status: newStatus } : prev);
    }
  }

  function handleReschedule(appointmentId: string, scheduledAt: string) {
    setAppointments((prev) =>
      prev.map((a) => (a.id === appointmentId ? { ...a, scheduledAt, status: "SCHEDULED" } : a))
    );
    if (selectedAppt?.id === appointmentId) {
      setSelectedAppt((prev) => prev ? { ...prev, scheduledAt, status: "SCHEDULED" } : prev);
    }
  }

  function handleSync() {
    startSync(async () => {
      await fetch("/api/trinks/sync", { method: "POST" });
      router.refresh();
    });
  }

  // Recompute KPIs from local state so they update when status changes
  const TOTAL_SLOTS = 20;
  const liveKpis: AgendaKPIs = {
    revenueCompleted: appointments
      .filter((a) => a.status === "COMPLETED")
      .reduce((s, a) => s + (a.price ?? 0), 0),
    revenueProjected: appointments
      .filter((a) => ["SCHEDULED", "CONFIRMED", "IN_PROGRESS"].includes(a.status))
      .reduce((s, a) => s + (a.price ?? 0), 0),
    completedCount:  appointments.filter((a) => a.status === "COMPLETED").length,
    cancelledCount:  appointments.filter((a) => a.status === "CANCELLED").length,
    noShowCount:     appointments.filter((a) => a.status === "NO_SHOW").length,
    occupancyRate:   Math.min(
      appointments.filter((a) => !["CANCELLED", "NO_SHOW"].includes(a.status)).length / TOTAL_SLOTS,
      1
    ),
    freeSlots:  Math.max(TOTAL_SLOTS - appointments.filter((a) => !["CANCELLED", "NO_SHOW"].includes(a.status)).length, 0),
    totalSlots: TOTAL_SLOTS,
  };

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{date}</p>
        {hasTrinks && (
          <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing}>
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="ml-1.5">Sincronizar Trinks</span>
          </Button>
        )}
      </div>

      <AgendaKPICards kpis={liveKpis} />

      {appointments.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          Nenhum agendamento para hoje.
        </div>
      ) : (
        <AgendaTimeline appointments={appointments} onSelect={openDrawer} />
      )}

      <AppointmentDrawer
        appointment={selectedAppt}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onStatusChange={handleStatusChange}
        onReschedule={handleReschedule}
      />
    </div>
  );
}
