// ============================================================
// Trinks Live Data
// Functions that read directly from Trinks API in real-time.
// Used for: today's agenda, current occupancy.
// NOT used for: customers, services (those come from local DB).
// ============================================================

import { prisma } from "@/lib/prisma";
import { buildTrinksClient } from "./client";
import type { TrinksAppointment } from "./types";

export interface LiveAppointment {
  id:            string;
  customerName:  string;
  serviceName:   string;
  scheduledAt:   Date;
  durationMin:   number;
  status:        string;
  statusLabel:   string;
  price:         number;
  profissional?: string;
  notes?:        string | null;
}

export interface LiveDayStats {
  appointments:    LiveAppointment[];
  totalSlots:      number;
  bookedSlots:     number;
  freeSlots:       number;
  occupancyRate:   number;
  projectedRevenue:number;
  completedRevenue:number;
  error?:          string; // if Trinks is unreachable, graceful degradation
}

const STATUS_LABEL: Record<string, string> = {
  agendado:   "Agendado",
  confirmado: "Confirmado",
  finalizado: "Concluído",
  cancelado:  "Cancelado",
};

// Working hours: 9h–19h, 50-min average slot = ~12 slots/day
const TOTAL_SLOTS = 12;

export async function getLiveDayStats(barbershopId: string): Promise<LiveDayStats> {
  const empty: LiveDayStats = {
    appointments: [], totalSlots: TOTAL_SLOTS, bookedSlots: 0,
    freeSlots: TOTAL_SLOTS, occupancyRate: 0, projectedRevenue: 0, completedRevenue: 0,
  };

  try {
    const integration = await prisma.integration.findUnique({ where: { barbershopId } });
    if (!integration?.configJson) return { ...empty, error: "Trinks não configurada" };

    const client = buildTrinksClient(integration.configJson);
    const res    = await client.getTodayAppointments();

    const active = res.data.filter(a => a.status?.nome?.toLowerCase() !== "cancelado");

    const appointments: LiveAppointment[] = res.data.map((a) => ({
      id:           String(a.id),
      customerName: a.cliente?.nome ?? "—",
      serviceName:  a.servico?.nome ?? "—",
      scheduledAt:  new Date(a.dataHoraInicio),
      durationMin:  a.duracaoEmMinutos ?? 30,
      status:       a.status?.nome?.toLowerCase() ?? "agendado",
      statusLabel:  STATUS_LABEL[a.status?.nome?.toLowerCase() ?? ""] ?? a.status?.nome ?? "—",
      price:        a.valor ?? 0,
      profissional: a.profissional?.nome,
      notes:        a.observacoesDoCliente ?? a.observacoesDoEstabelecimento,
    }));

    // Sort by time
    appointments.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

    const projectedRevenue  = active.reduce((s, a) => s + (a.valor ?? 0), 0);
    const completedRevenue  = res.data
      .filter(a => a.status?.nome?.toLowerCase() === "finalizado")
      .reduce((s, a) => s + (a.valor ?? 0), 0);

    const bookedSlots    = active.length;
    const occupancyRate  = Math.min(bookedSlots / TOTAL_SLOTS, 1);

    return {
      appointments,
      totalSlots:       TOTAL_SLOTS,
      bookedSlots,
      freeSlots:        Math.max(TOTAL_SLOTS - bookedSlots, 0),
      occupancyRate,
      projectedRevenue,
      completedRevenue,
    };
  } catch (err) {
    console.error("Trinks live fetch error:", err);
    return { ...empty, error: "Erro ao conectar com a Trinks. Dados podem estar desatualizados." };
  }
}
