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
    // Future adapters:
    // case "anthropic": _provider = new AnthropicProvider(); break;
    // case "groq":      _provider = new GroqProvider(); break;
    default:
      _provider = new OpenAIProvider();
  }

  return _provider;
}

// ── Context builder ────────────────────────────────────────
// Builds AI context from DB state for a given barbershop

import { prisma } from "@/lib/prisma";
import type { AISuggestionRequest, CopilotContext } from "./types";
import { startOfDay, endOfDay, format, getDay, startOfWeek, endOfWeek } from "date-fns";

const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export async function buildAIContext(barbershopId: string): Promise<AISuggestionRequest> {
  const now   = new Date();
  const start = startOfDay(now);
  const end   = endOfDay(now);

  const [barbershop, todayAppointments, inactiveCount, recentCampaigns, goal] =
    await Promise.all([
      prisma.barbershop.findUnique({ where: { id: barbershopId } }),

      prisma.appointment.findMany({
        where: {
          barbershopId,
          scheduledAt: { gte: start, lte: end },
        },
        include: { service: true },
      }),

      prisma.customer.count({
        where: {
          barbershopId,
          status: "ACTIVE",
          lastVisitAt: { lt: new Date(Date.now() - 30 * 86400_000) },
        },
      }),

      prisma.campaign.findMany({
        where:   { barbershopId, status: { in: ["APPROVED", "PUBLISHED"] } },
        orderBy: { createdAt: "desc" },
        take:    3,
        select:  { title: true },
      }),

      prisma.goal.findFirst({
        where: {
          barbershopId,
          month: now.getMonth() + 1,
          year:  now.getFullYear(),
        },
      }),
    ]);

  // Work hours: 9-19, every 30min = 20 slots
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
    barbershopName:  barbershop?.name ?? "Barbearia",
    date:            format(now, "dd/MM/yyyy"),
    dayOfWeek:       DAY_NAMES[getDay(now)],
    totalSlots:      TOTAL_SLOTS,
    bookedSlots,
    freeSlots:       TOTAL_SLOTS - bookedSlots,
    occupancyRate:   bookedSlots / TOTAL_SLOTS,
    revenueToday,
    revenueGoal:     goal?.revenueTarget ? Number(goal.revenueTarget) : undefined,
    topServices,
    inactiveClients: inactiveCount,
    recentCampaigns: recentCampaigns.map((c) => c.title),
  };
}

// ── Copilot context: mais rico para respostas executivas ──

export async function buildCopilotContext(barbershopId: string): Promise<CopilotContext> {
  const now = new Date();
  const start = startOfDay(now);
  const end = endOfDay(now);

  const [barbershop, appointmentsToday, inactiveCount, campaigns, goalMonth, goalWeek] = await Promise.all([
    prisma.barbershop.findUnique({ where: { id: barbershopId } }),
    prisma.appointment.findMany({
      where: { barbershopId, scheduledAt: { gte: start, lte: end } },
      include: { service: true },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.customer.count({
      where: {
        barbershopId,
        status: "ACTIVE",
        lastVisitAt: { lt: new Date(Date.now() - 30 * 86400_000) },
      },
    }),
    prisma.campaign.findMany({
      where: { barbershopId, status: { in: ["APPROVED", "PUBLISHED"] } },
      select: { title: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.goal.findFirst({
      where: { barbershopId, month: now.getMonth() + 1, year: now.getFullYear() },
    }),
    prisma.goal.findFirst({
      where: { barbershopId, month: 0, year: 0 }, // reserved for weekly placeholders if configured
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
        .slice(0, 4); // coarse view only

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

  // Week progress (using appointments completed in current ISO week)
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const weekAggregate = await prisma.appointment.aggregate({
    where: {
      barbershopId,
      scheduledAt: { gte: weekStart, lte: weekEnd },
      status: "COMPLETED",
    },
    _sum: { price: true },
  });

  const weekRevenue = Number(weekAggregate._sum.price ?? 0);
  const weekGoalValue = goalWeek?.revenueTarget ?? goalMonth?.revenueTarget ?? null;
  const weekProgress = weekGoalValue ? Math.min(weekRevenue / Number(weekGoalValue), 1) : null;

  return {
    barbershopName: barbershop?.name ?? "Barbearia",
    date: format(now, "dd/MM/yyyy"),
    dayOfWeek: DAY_NAMES[getDay(now)],
    occupancyRate,
    totalSlots: TOTAL_SLOTS,
    bookedSlots,
    freeSlots: Math.max(TOTAL_SLOTS - bookedSlots, 0),
    freeWindows,
    projectedRevenue,
    completedRevenue,
    revenueGoal: goalMonth?.revenueTarget ? Number(goalMonth.revenueTarget) : null,
    topServices,
    inactiveClients: inactiveCount,
    campaigns: campaigns.map((c) => c.title),
    weekGoal: weekGoalValue ? Number(weekGoalValue) : null,
    weekProgress,
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
