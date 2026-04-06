import { requireBarbershop } from "@/lib/auth";
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
  const session = await requireBarbershop();

  const barbershopId = session.user.barbershopId;
  const now          = new Date();

  const { view: viewParam } = await searchParams;
  const view = viewParam === "week" || viewParam === "month" ? viewParam : "today";

  // Fetch in parallel: live Trinks data + local DB data
  const [liveDay, barbershop, goal, inactiveCount, offerAppointments] =
    await Promise.all([
      getLiveDayStats(barbershopId),

      prisma.barbershop.findUnique({
        where:  { id: barbershopId },
        select: { name: true, trinksConfigured: true, dashboardWidgets: true },
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

  const periodStart =
    view === "week"  ? startOfWeek(now, { weekStartsOn: 0 })
    : view === "month" ? startOfMonth(now)
    : null;
  const periodEnd =
    view === "week"  ? endOfWeek(now, { weekStartsOn: 0 })
    : view === "month" ? endOfMonth(now)
    : null;

  const periodStats =
    periodStart && periodEnd
      ? await getPeriodStats(barbershopId, periodStart, periodEnd, revenueGoal)
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
  const weekStart  = startOfWeek(now, { weekStartsOn: 0 });

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
        periodLabel={
          view === "week" && periodStart && periodEnd
            ? `${format(periodStart, "d 'de' MMM", { locale: ptBR })} — ${format(periodEnd, "d 'de' MMM", { locale: ptBR })}`
            : view === "month"
            ? `Semana ${Math.ceil(now.getDate() / 7)} de ${format(now, "MMMM", { locale: ptBR })}`
            : undefined
        }
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
