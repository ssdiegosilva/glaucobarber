// ============================================================
// AI Provider Factory
// Swap providers via AI_PROVIDER env var
// ============================================================

import type { AIProvider } from "./types";
import { OpenAIProvider } from "./openai";

export {
  type AIProvider,
  type AISuggestionRequest,
  type AISuggestion,
  type CopilotContext,
  type CopilotResponse,
  type CopilotActionSuggestion,
} from "./types";

let _provider: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (_provider) return _provider;

  const name = process.env.AI_PROVIDER ?? "openai";

  switch (name) {
    case "openai":
      _provider = new OpenAIProvider();
      break;
    default:
      _provider = new OpenAIProvider();
  }

  return _provider;
}

// ── Context builder ────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import type { AISuggestionRequest, CopilotContext } from "./types";
import { startOfDay, endOfDay, format, getDay, startOfWeek, endOfWeek, subDays } from "date-fns";

const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export async function buildAIContext(barbershopId: string): Promise<AISuggestionRequest> {
  const now   = new Date();
  const start = startOfDay(now);
  const end   = endOfDay(now);

  const [
    barbershop,
    todayAppointments,
    clientsAtRisk,
    clientsInactive,
    clientsReactivated,
    pendingGoogleReviews,
    recentCampaigns,
    goal,
  ] = await Promise.all([
    prisma.barbershop.findUnique({ where: { id: barbershopId } }),

    prisma.appointment.findMany({
      where: { barbershopId, scheduledAt: { gte: start, lte: end } },
      include: { service: true },
    }),

    // EM_RISCO: 14–60 dias sem visita, sem agendamento futuro
    prisma.customer.count({
      where: { barbershopId, postSaleStatus: "EM_RISCO" },
    }),

    // INATIVO: >60 dias sem visita
    prisma.customer.count({
      where: { barbershopId, postSaleStatus: "INATIVO" },
    }),

    // REATIVADO: voltaram nos últimos 60 dias
    prisma.customer.count({
      where: {
        barbershopId,
        postSaleStatus: "REATIVADO",
        reactivatedAt: { gte: subDays(now, 60) },
      },
    }),

    // Avaliações Google pendentes (48h pós-atendimento)
    prisma.customerReview.count({
      where: {
        barbershopId,
        requestStatus: "pendente",
        appointment: { completedAt: { gte: subDays(now, 2) } },
        customer: { reviewOptOut: false },
      },
    }),

    prisma.campaign.findMany({
      where:   { barbershopId, status: { in: ["APPROVED", "PUBLISHED"] } },
      orderBy: { createdAt: "desc" },
      take:    3,
      select:  { title: true },
    }),

    prisma.goal.findFirst({
      where: { barbershopId, month: now.getMonth() + 1, year: now.getFullYear() },
    }),
  ]);

  const TOTAL_SLOTS = 20;
  const bookedSlots = todayAppointments.filter(
    (a) => a.status !== "CANCELLED" && a.status !== "NO_SHOW"
  ).length;

  const revenueToday = todayAppointments
    .filter((a) => a.status === "COMPLETED" || a.status === "SCHEDULED")
    .reduce((sum, a) => sum + Number(a.price ?? 0), 0);

  const serviceCounts = new Map<string, number>();
  todayAppointments.forEach((a) => {
    if (a.service?.name) {
      serviceCounts.set(a.service.name, (serviceCounts.get(a.service.name) ?? 0) + 1);
    }
  });
  const topServices = [...serviceCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  return {
    barbershopName:       barbershop?.name ?? "Barbearia",
    date:                 format(now, "dd/MM/yyyy"),
    dayOfWeek:            DAY_NAMES[getDay(now)],
    totalSlots:           TOTAL_SLOTS,
    bookedSlots,
    freeSlots:            TOTAL_SLOTS - bookedSlots,
    occupancyRate:        bookedSlots / TOTAL_SLOTS,
    revenueToday,
    revenueGoal:          goal?.revenueTarget ? Number(goal.revenueTarget) : undefined,
    topServices,
    clientsAtRisk,
    clientsInactive,
    clientsReactivated,
    pendingGoogleReviews,
    recentCampaigns:      recentCampaigns.map((c) => c.title),
  };
}

// ── Copilot context: mais rico para respostas executivas ──

export async function buildCopilotContext(barbershopId: string): Promise<CopilotContext> {
  const now   = new Date();
  const start = startOfDay(now);
  const end   = endOfDay(now);

  const [
    barbershop,
    appointmentsToday,
    clientsAtRisk,
    clientsInactive,
    clientsReactivated,
    pendingGoogleReviews,
    activeCampaignsRaw,
    publishedCampaignsRaw,
    goalMonth,
    goalWeek,
  ] = await Promise.all([
    prisma.barbershop.findUnique({ where: { id: barbershopId } }),

    prisma.appointment.findMany({
      where: { barbershopId, scheduledAt: { gte: start, lte: end } },
      include: { service: true },
      orderBy: { scheduledAt: "asc" },
    }),

    prisma.customer.count({ where: { barbershopId, postSaleStatus: "EM_RISCO" } }),
    prisma.customer.count({ where: { barbershopId, postSaleStatus: "INATIVO" } }),
    prisma.customer.count({
      where: { barbershopId, postSaleStatus: "REATIVADO", reactivatedAt: { gte: subDays(now, 60) } },
    }),

    prisma.customerReview.count({
      where: {
        barbershopId,
        requestStatus: "pendente",
        appointment: { completedAt: { gte: subDays(now, 2) } },
        customer: { reviewOptOut: false },
      },
    }),

    // Campanhas aprovadas/agendadas (ainda não publicadas)
    prisma.campaign.findMany({
      where: { barbershopId, status: { in: ["APPROVED", "SCHEDULED"] } },
      select: { title: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),

    // Campanhas publicadas no Instagram (com permalink)
    prisma.campaign.findMany({
      where: { barbershopId, status: "PUBLISHED" },
      select: { title: true, instagramPermalink: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),

    prisma.goal.findFirst({
      where: { barbershopId, month: now.getMonth() + 1, year: now.getFullYear() },
    }),

    prisma.goal.findFirst({
      where: { barbershopId, month: 0, year: 0 }, // weekly (month=0 convention)
    }),
  ]);

  const TOTAL_SLOTS = 20;
  const active = appointmentsToday.filter((a) => a.status !== "CANCELLED" && a.status !== "NO_SHOW");
  const bookedSlots = active.length;
  const occupancyRate = Math.min(bookedSlots / TOTAL_SLOTS, 1);

  const projectedRevenue = active.reduce((sum, a) => sum + Number(a.price ?? 0), 0);
  const completedRevenue = appointmentsToday
    .filter((a) => a.status === "COMPLETED")
    .reduce((sum, a) => sum + Number(a.price ?? 0), 0);

  const freeWindows = appointmentsToday.length === 0
    ? ["manhã inteira", "tarde inteira"]
    : appointmentsToday
        .map((a) => format(a.scheduledAt, "HH:mm"))
        .slice(0, 4);

  const serviceCounts = new Map<string, number>();
  appointmentsToday.forEach((a) => {
    if (a.service?.name) {
      serviceCounts.set(a.service.name, (serviceCounts.get(a.service.name) ?? 0) + 1);
    }
  });
  const topServices = [...serviceCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd   = endOfWeek(now, { weekStartsOn: 1 });
  const weekAggregate = await prisma.appointment.aggregate({
    where: { barbershopId, scheduledAt: { gte: weekStart, lte: weekEnd }, status: "COMPLETED" },
    _sum: { price: true },
  });

  const weekRevenue  = Number(weekAggregate._sum.price ?? 0);
  const weekGoalValue = goalWeek?.revenueTarget ?? goalMonth?.revenueTarget ?? null;
  const weekProgress  = weekGoalValue ? Math.min(weekRevenue / Number(weekGoalValue), 1) : null;

  // ── Overlap detection ──────────────────────────────────
  // Group active appointments by professional (barberId), sort by time, detect overlaps
  const withCustomers = await prisma.appointment.findMany({
    where:   { barbershopId, scheduledAt: { gte: start, lte: end }, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
    include: { customer: { select: { name: true, phone: true, appointments: {
      where:  { status: "COMPLETED" },
      select: { scheduledAt: true },
      orderBy: { scheduledAt: "desc" },
      take: 10,
    } } } },
    orderBy: { scheduledAt: "asc" },
  });

  // Group by barberId (null = "unassigned")
  const byPro = new Map<string, typeof withCustomers>();
  for (const a of withCustomers) {
    const key = a.barberId ?? "__none__";
    if (!byPro.has(key)) byPro.set(key, []);
    byPro.get(key)!.push(a);
  }

  const overlaps: CopilotContext["overlaps"] = [];
  const dayNames = ["domingos", "segundas", "terças", "quartas", "quintas", "sextas", "sábados"];

  for (const [barberId, appts] of byPro) {
    const sorted = [...appts].sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      const aEnd = new Date(a.scheduledAt.getTime() + (a.durationMin ?? 30) * 60_000);
      if (b.scheduledAt < aEnd) {
        // Compute alternative hint from clientB's historical appointment pattern
        const hist = b.customer?.appointments ?? [];
        let alternativeHint: string | null = null;
        if (hist.length >= 2) {
          const dayCounts  = new Map<number, number>();
          const hourCounts = new Map<number, number>();
          for (const h of hist) {
            const d = new Date(h.scheduledAt);
            dayCounts.set(d.getDay(),   (dayCounts.get(d.getDay())   ?? 0) + 1);
            hourCounts.set(d.getHours(), (hourCounts.get(d.getHours()) ?? 0) + 1);
          }
          const bestDay  = [...dayCounts.entries()].sort((x, y) => y[1] - x[1])[0];
          const bestHour = [...hourCounts.entries()].sort((x, y) => y[1] - x[1])[0];
          if (bestDay && bestHour) {
            alternativeHint = `costuma vir nas ${dayNames[bestDay[0]]} às ${bestHour[0].toString().padStart(2, "0")}:00`;
          }
        }

        overlaps.push({
          professionalName: barberId === "__none__" ? null : barberId,
          clientA: { name: a.customer?.name ?? "—", phone: a.customer?.phone ?? null },
          clientB: { name: b.customer?.name ?? "—", phone: b.customer?.phone ?? null },
          startA:  format(a.scheduledAt, "HH:mm"),
          startB:  format(b.scheduledAt, "HH:mm"),
          alternativeHint,
        });
      }
    }
  }

  return {
    barbershopName:       barbershop?.name ?? "Barbearia",
    date:                 format(now, "dd/MM/yyyy"),
    dayOfWeek:            DAY_NAMES[getDay(now)],
    occupancyRate,
    totalSlots:           TOTAL_SLOTS,
    bookedSlots,
    freeSlots:            Math.max(TOTAL_SLOTS - bookedSlots, 0),
    freeWindows,
    projectedRevenue,
    completedRevenue,
    revenueGoal:          goalMonth?.revenueTarget ? Number(goalMonth.revenueTarget) : null,
    topServices,
    clientsAtRisk,
    clientsInactive,
    clientsReactivated,
    pendingGoogleReviews,
    activeCampaigns:      activeCampaignsRaw.map((c) => c.title),
    publishedCampaigns:   publishedCampaignsRaw.map((c) => ({ title: c.title, permalink: c.instagramPermalink })),
    weekGoal:             weekGoalValue ? Number(weekGoalValue) : null,
    weekProgress,
    overlaps,
  };
}

// ── Save suggestions to DB ─────────────────────────────────

import type { AISuggestion } from "./types";

export async function saveAISuggestions(
  barbershopId: string,
  suggestions:  AISuggestion[],
  context:      AISuggestionRequest
): Promise<void> {
  const contextJson = JSON.stringify(context);

  await prisma.suggestion.createMany({
    data: suggestions.map((s) => ({
      barbershopId,
      type:    s.type,
      status:  "PENDING",
      title:   s.title,
      content: s.content,
      reason:  s.reason,
      context: contextJson,
    })),
    skipDuplicates: true,
  });
}
