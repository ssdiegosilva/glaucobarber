// ============================================================
// Trinks Live Data
// Functions that read directly from Trinks API in real-time.
// Used for: today's agenda, current occupancy.
// NOT used for: customers, services (those come from local DB).
// ============================================================

import { format } from "date-fns";
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
      scheduledAt:  new Date(a.dataHoraInicio + "-03:00"), // Trinks returns local BRT (UTC-3) without TZ info
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

// ── Period Stats (week / month) — queries local DB ──────────

export interface PeriodStats {
  totalAppointments: number;
  completedCount:    number;
  completedRevenue:  number;
  avgTicket:         number;
  goalProgress:      number | null; // 0–1
  dailyRevenue:      { day: string; revenue: number; count: number }[];
}

export async function getPeriodStats(
  barbershopId: string,
  start:        Date,
  end:          Date,
  revenueGoal:  number | null,
): Promise<PeriodStats> {
  const [total, aggregate, rawAppointments] = await Promise.all([
    prisma.appointment.count({
      where: {
        barbershopId,
        scheduledAt: { gte: start, lte: end },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
    }),
    prisma.appointment.aggregate({
      where: {
        barbershopId,
        scheduledAt: { gte: start, lte: end },
        status: "COMPLETED",
      },
      _sum:   { price: true },
      _count: { _all: true },
    }),
    prisma.appointment.findMany({
      where: {
        barbershopId,
        scheduledAt: { gte: start, lte: end },
        status: { notIn: ["CANCELLED"] },
      },
      select: { scheduledAt: true, price: true, status: true },
      orderBy: { scheduledAt: "asc" },
    }),
  ]);

  const completedRevenue = Number(aggregate._sum.price ?? 0);
  const completedCount   = aggregate._count._all;
  const avgTicket        = completedCount > 0 ? completedRevenue / completedCount : 0;

  // Daily breakdown
  const dailyMap = new Map<string, { revenue: number; count: number }>();
  for (const apt of rawAppointments) {
    const day  = format(apt.scheduledAt, "dd/MM");
    const curr = dailyMap.get(day) ?? { revenue: 0, count: 0 };
    curr.count++;
    if (apt.status === "COMPLETED") curr.revenue += Number(apt.price ?? 0);
    dailyMap.set(day, curr);
  }
  const dailyRevenue = Array.from(dailyMap.entries()).map(([day, data]) => ({ day, ...data }));

  const goalProgress =
    revenueGoal && revenueGoal > 0
      ? Math.min(completedRevenue / revenueGoal, 1)
      : null;

  return { totalAppointments: total, completedCount, completedRevenue, avgTicket, goalProgress, dailyRevenue };
}
