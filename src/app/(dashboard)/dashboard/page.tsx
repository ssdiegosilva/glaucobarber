import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { DashboardClient } from "./dashboard-client";
import { getLiveDayStats, getPeriodStats } from "@/lib/integrations/trinks/live";
import { format, getDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.barbershopId) redirect("/onboarding");

  const barbershopId = session.user.barbershopId;
  const now          = new Date();

  const { view: viewParam } = await searchParams;
  const view = viewParam === "week" || viewParam === "month" ? viewParam : "today";

  // Fetch in parallel: live Trinks data + local DB data
  const [liveDay, barbershop, pendingSuggestions, approvedSuggestions, recentCampaign, goal, inactiveCount, offerAppointments] =
    await Promise.all([
      getLiveDayStats(barbershopId),

      prisma.barbershop.findUnique({
        where:  { id: barbershopId },
        select: { name: true, trinksConfigured: true, lastDailyGiftAt: true, dashboardWidgets: true },
      }),

      prisma.suggestion.findMany({
        where:   { barbershopId, status: "PENDING" },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),

      prisma.suggestion.findMany({
        where:   { barbershopId, status: { in: ["APPROVED", "EXECUTED"] } },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),

      prisma.campaign.findFirst({
        where:   { barbershopId, status: "APPROVED" },
        orderBy: { createdAt: "desc" },
      }),

      prisma.goal.findFirst({
        where:  { barbershopId, month: now.getMonth() + 1, year: now.getFullYear() },
        select: { revenueTarget: true, offDaysOfWeek: true, workingDaysCount: true },
      }),

      prisma.customer.count({
        where: {
          barbershopId,
          status:      "ACTIVE",
          lastVisitAt: { lt: new Date(Date.now() - 30 * 86400_000) },
        },
      }),

      // Local appointments with offers today
      prisma.appointment.findMany({
        where: {
          barbershopId,
          scheduledAt: { gte: startOfDay(now), lte: endOfDay(now) },
          offerId:     { not: null },
        },
        select: { trinksId: true, offerId: true, offer: { select: { title: true } } },
      }),
    ]);

  // Off-day check
  const todayDow   = now.getDay(); // 0=Sun … 6=Sat
  const offDays    = goal?.offDaysOfWeek ?? [];
  const isOffDay   = offDays.includes(todayDow);
  const workingDaysCount = goal?.workingDaysCount ?? null;

  // Period stats for week / month views
  const revenueGoal = goal?.revenueTarget ? Number(goal.revenueTarget) : null;

  const periodStats =
    view === "week"
      ? await getPeriodStats(
          barbershopId,
          startOfWeek(now, { weekStartsOn: 1 }),
          endOfWeek(now, { weekStartsOn: 1 }),
          revenueGoal,
        )
      : view === "month"
      ? await getPeriodStats(barbershopId, startOfMonth(now), endOfMonth(now), revenueGoal)
      : null;

  // Widget preferences
  const DEFAULT_WIDGETS = ["revenue_today", "occupancy_today", "inactive_clients"];
  let selectedWidgets: string[] = DEFAULT_WIDGETS;
  try {
    const raw = JSON.parse(barbershop?.dashboardWidgets ?? "[]");
    if (Array.isArray(raw) && raw.length > 0) selectedWidgets = raw;
  } catch { /* keep default */ }

  // Extra widget data (only fetch what's needed)
  const monthStart = startOfMonth(now);
  const monthEnd   = endOfMonth(now);
  const weekStart  = startOfWeek(now, { weekStartsOn: 1 });

  const [avgTicketData, newClientsCount, returnRateData, weeklyRevenueData, topServiceData, whatsappQueueCount] =
    await Promise.all([
      // avg_ticket: average of completed appointments this month
      selectedWidgets.includes("avg_ticket")
        ? prisma.appointment.aggregate({
            where: { barbershopId, status: "COMPLETED", scheduledAt: { gte: monthStart, lte: monthEnd } },
            _avg:  { price: true },
            _count: { _all: true },
          })
        : null,

      // new_clients: customers created in last 30 days
      selectedWidgets.includes("new_clients")
        ? prisma.customer.count({ where: { barbershopId, createdAt: { gte: new Date(Date.now() - 30 * 86400_000) } } })
        : null,

      // return_rate: clients who visited in last 45 days / total active clients
      selectedWidgets.includes("return_rate")
        ? Promise.all([
            prisma.customer.count({ where: { barbershopId, status: "ACTIVE", lastVisitAt: { gte: new Date(Date.now() - 45 * 86400_000) } } }),
            prisma.customer.count({ where: { barbershopId, status: "ACTIVE" } }),
          ])
        : null,

      // weekly_revenue: sum of completed appointments this week
      selectedWidgets.includes("weekly_revenue")
        ? prisma.appointment.aggregate({
            where: { barbershopId, status: "COMPLETED", scheduledAt: { gte: weekStart, lte: now } },
            _sum: { price: true },
          })
        : null,

      // top_service: most booked service this month
      selectedWidgets.includes("top_service")
        ? prisma.appointment.groupBy({
            by:    ["serviceId"],
            where: { barbershopId, serviceId: { not: null }, scheduledAt: { gte: monthStart, lte: monthEnd } },
            _count: { _all: true },
            orderBy: { _count: { serviceId: "desc" } },
            take: 1,
          })
        : null,

      // whatsapp_queue: count of QUEUED messages
      selectedWidgets.includes("whatsapp_queue")
        ? prisma.whatsappMessage.count({ where: { barbershopId, status: "QUEUED" } })
        : null,
    ]);

  // Compute return rate
  const returnRatePct = returnRateData
    ? (returnRateData[1] > 0 ? Math.round((returnRateData[0] / returnRateData[1]) * 100) : 0)
    : null;

  // Monthly goal progress
  const monthlyGoalPct = revenueGoal && periodStats
    ? periodStats.goalProgress
    : revenueGoal
    ? await (async () => {
        const monthRevenue = await prisma.appointment.aggregate({
          where: { barbershopId, status: "COMPLETED", scheduledAt: { gte: monthStart, lte: monthEnd } },
          _sum:  { price: true },
        });
        const actual = Number(monthRevenue._sum.price ?? 0);
        return revenueGoal > 0 ? actual / revenueGoal : null;
      })()
    : null;

  // Map trinksId → offer title for badge display
  const offerByTrinksId = new Map(
    offerAppointments
      .filter((a) => a.trinksId && a.offer?.title)
      .map((a) => [a.trinksId!, a.offer!.title])
  );

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Dashboard"
        subtitle={`${DAY_NAMES[getDay(now)]}, ${format(now, "d 'de' MMMM", { locale: ptBR })}`}
        userName={session.user.name}
      />

      <DashboardClient
        view={view}
        barbershopName={barbershop?.name ?? ""}
        trinksConfigured={barbershop?.trinksConfigured ?? false}
        dailyGiftAvailable={!barbershop?.lastDailyGiftAt || barbershop.lastDailyGiftAt < startOfDay(now)}
        liveError={liveDay.error}
        isOffDay={isOffDay}
        stats={{
          totalSlots:        liveDay.totalSlots,
          bookedSlots:       liveDay.bookedSlots,
          freeSlots:         liveDay.freeSlots,
          occupancyRate:     liveDay.occupancyRate,
          completedRevenue:  liveDay.completedRevenue,
          projectedRevenue:  liveDay.projectedRevenue,
          revenueGoal,
          workingDaysCount,
          inactiveClients:   inactiveCount,
        }}
        appointments={liveDay.appointments.map((a) => ({
          id:           a.id,
          customerName: a.customerName,
          serviceName:  a.serviceName,
          scheduledAt:  a.scheduledAt.toISOString(),
          status:       a.status,
          statusLabel:  a.statusLabel,
          price:        a.price,
          profissional: a.profissional,
          offerTitle:   offerByTrinksId.get(a.id) ?? null,
        }))}
        suggestions={pendingSuggestions.map((s) => ({
          id:      s.id,
          type:    s.type,
          title:   s.title,
          content: s.content,
          reason:  s.reason,
        }))}
        approvedSuggestions={approvedSuggestions.map((s) => ({
          id:      s.id,
          type:    s.type,
          title:   s.title,
          content: s.content,
          reason:  s.reason,
        }))}
        campaign={recentCampaign ? {
          id:      recentCampaign.id,
          title:   recentCampaign.title,
          text:    recentCampaign.text,
          channel: recentCampaign.channel ?? "",
        } : null}
        periodStats={periodStats ? {
          totalAppointments: periodStats.totalAppointments,
          completedCount:    periodStats.completedCount,
          completedRevenue:  periodStats.completedRevenue,
          avgTicket:         periodStats.avgTicket,
          goalProgress:      periodStats.goalProgress,
          dailyRevenue:      periodStats.dailyRevenue,
        } : null}
        initialWidgets={selectedWidgets}
        widgetData={{
          avgTicket:       avgTicketData?._count._all ? Number(avgTicketData._avg.price ?? 0) : null,
          newClients:      newClientsCount ?? null,
          returnRate:      returnRatePct,
          weeklyRevenue:   weeklyRevenueData ? Number(weeklyRevenueData._sum.price ?? 0) : null,
          topService:      await (async () => {
            const topId = topServiceData?.[0]?.serviceId;
            if (!topId) return null;
            const svc = await prisma.service.findUnique({ where: { id: topId }, select: { name: true } });
            return svc?.name ?? null;
          })(),
          whatsappQueue:   whatsappQueueCount ?? null,
          monthlyGoalPct,
        }}
      />
    </div>
  );
}
