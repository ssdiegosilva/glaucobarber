// ============================================================
// AI Provider Factory
// Swap providers via AI_PROVIDER env var
// ============================================================

import type { AIProvider } from "./types";
import { AnthropicProvider } from "./anthropic";

export { type AIProvider, type AISuggestionRequest, type AISuggestion } from "./types";

let _provider: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (_provider) return _provider;

  const name = process.env.AI_PROVIDER ?? "anthropic";

  switch (name) {
    case "anthropic":
      _provider = new AnthropicProvider();
      break;
    // Future adapters:
    // case "openai": _provider = new OpenAIProvider(); break;
    // case "groq":   _provider = new GroqProvider(); break;
    // case "local":  _provider = new LocalProvider(); break;
    default:
      _provider = new AnthropicProvider();
  }

  return _provider;
}

// ── Context builder ────────────────────────────────────────
// Builds AI context from DB state for a given barbershop

import { prisma } from "@/lib/prisma";
import type { AISuggestionRequest } from "./types";
import { startOfDay, endOfDay, format, getDay } from "date-fns";

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
