import { requireBarbershop } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { DashboardClient } from "./dashboard-client";
import { ProductDashboardClient } from "./product-dashboard-client";
import { getLiveDayStats, getPeriodStats } from "@/lib/integrations/trinks/live";
import { getSegmentTheme } from "@/lib/core/segment";
import { format, getDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const DAY_ABBR = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await requireBarbershop();

  const barbershopId = session.user.barbershopId;
  const now          = new Date();

  // ── Detect product-only segment ──
  const segmentTheme = await getSegmentTheme(barbershopId);
  let availableModules: string[] = [];
  try { availableModules = JSON.parse(segmentTheme?.availableModules ?? "[]"); } catch {}
  const isProductOnly = availableModules.includes("visitas") && !availableModules.includes("agenda");

  if (isProductOnly) {
    return renderProductDashboard(session, barbershopId, now, segmentTheme);
  }

  const { view: viewParam } = await searchParams;
  const view = viewParam === "week" || viewParam === "month" ? viewParam : "today";

  // Fetch in parallel: live Trinks data + local DB data
  const [liveDay, barbershop, goal, inactiveCount] =
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
          postSaleStatus: "INATIVO",
        },
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

  const offerByTrinksId = new Map<string, string>();

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

// ════════════════════════════════════════════════════════════════
// Product-only dashboard (visitas, no agenda)
// ════════════════════════════════════════════════════════════════

async function renderProductDashboard(
  session: any,
  barbershopId: string,
  now: Date,
  segmentTheme: Awaited<ReturnType<typeof getSegmentTheme>>,
) {
  const todayStart     = startOfDay(now);
  const todayEnd       = endOfDay(now);
  const yesterdayStart = startOfDay(subDays(now, 1));
  const yesterdayEnd   = endOfDay(subDays(now, 1));
  const weekStart      = startOfWeek(now, { weekStartsOn: 1 });
  const thirtyDaysAgo  = subDays(now, 30);
  const sevenDaysAgo   = startOfDay(subDays(now, 6)); // 7 days including today

  const [
    todayAgg,
    yesterdayAgg,
    weekAgg,
    last7DaysVisits,
    todayVisits,
    topProductsRaw,
    topCustomersRaw,
  ] = await Promise.all([
    // Today aggregate
    prisma.visit.aggregate({
      where: { barbershopId, visitedAt: { gte: todayStart, lte: todayEnd } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    // Yesterday aggregate
    prisma.visit.aggregate({
      where: { barbershopId, visitedAt: { gte: yesterdayStart, lte: yesterdayEnd } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    // Week aggregate
    prisma.visit.aggregate({
      where: { barbershopId, visitedAt: { gte: weekStart, lte: todayEnd } },
      _sum: { amount: true },
    }),
    // Last 7 days visits (for chart — aggregate in JS)
    prisma.visit.findMany({
      where: { barbershopId, visitedAt: { gte: sevenDaysAgo, lte: todayEnd } },
      select: { visitedAt: true, amount: true },
    }),
    // Today's visits (for recent sales list)
    prisma.visit.findMany({
      where: { barbershopId, visitedAt: { gte: todayStart, lte: todayEnd } },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        items: { select: { name: true, quantity: true, price: true } },
      },
      orderBy: { visitedAt: "desc" },
      take: 50,
    }),
    // Top 5 products (last 30 days)
    prisma.$queryRaw<{ name: string; total_qty: bigint; total_revenue: any }[]>`
      SELECT vi.name, SUM(vi.quantity)::bigint AS total_qty, SUM(vi.price * vi.quantity) AS total_revenue
      FROM visit_items vi
      JOIN visits v ON vi."visitId" = v.id
      WHERE v."barbershopId" = ${barbershopId}
        AND v."visitedAt" >= ${thirtyDaysAgo}
      GROUP BY vi.name
      ORDER BY total_qty DESC
      LIMIT 5
    `,
    // Top 5 customers (last 30 days)
    prisma.$queryRaw<{ id: string; name: string; visit_count: bigint; total_spent: any; phone: string | null }[]>`
      SELECT c.id, c.name, COUNT(v.id)::bigint AS visit_count, COALESCE(SUM(v.amount), 0) AS total_spent, c.phone
      FROM visits v
      JOIN customers c ON v."customerId" = c.id
      WHERE v."barbershopId" = ${barbershopId}
        AND v."visitedAt" >= ${thirtyDaysAgo}
        AND v."customerId" IS NOT NULL
      GROUP BY c.id, c.name, c.phone
      ORDER BY visit_count DESC
      LIMIT 5
    `,
  ]);

  // KPIs
  const revenueToday     = Number(todayAgg._sum.amount ?? 0);
  const revenueYesterday = Number(yesterdayAgg._sum.amount ?? 0);
  const visitsToday      = todayAgg._count._all;
  const visitsYesterday  = yesterdayAgg._count._all;
  const avgTicketToday   = visitsToday > 0 ? revenueToday / visitsToday : 0;
  const revenueWeek      = Number(weekAgg._sum.amount ?? 0);

  // Chart: group last 7 days
  const chartMap = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    const d = subDays(now, i);
    chartMap.set(format(d, "yyyy-MM-dd"), 0);
  }
  for (const v of last7DaysVisits) {
    const key = format(v.visitedAt, "yyyy-MM-dd");
    chartMap.set(key, (chartMap.get(key) ?? 0) + Number(v.amount ?? 0));
  }
  const chartData = [...chartMap.entries()].map(([dateStr, revenue]) => ({
    day: DAY_ABBR[new Date(dateStr + "T12:00:00").getDay()],
    revenue,
  }));

  // Top products
  const topProducts = topProductsRaw.map((p) => ({
    name:     p.name,
    quantity: Number(p.total_qty),
    revenue:  Number(p.total_revenue),
  }));

  // Top customers
  const topCustomers = topCustomersRaw.map((c) => ({
    id:         c.id,
    name:       c.name,
    visitCount: Number(c.visit_count),
    totalSpent: Number(c.total_spent),
    phone:      c.phone,
  }));

  // Recent sales
  const recentSales = todayVisits.map((v) => ({
    id:            v.id,
    visitedAt:     v.visitedAt.toISOString(),
    amount:        v.amount != null ? Number(v.amount) : null,
    customerName:  v.customer?.name ?? null,
    customerPhone: v.customer?.phone ?? null,
    items:         v.items.map((i) => ({ name: i.name, quantity: i.quantity, price: Number(i.price) })),
  }));

  const tenantLabel = segmentTheme?.tenantLabel ?? "estabelecimento";

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Dashboard"
        subtitle={`${DAY_NAMES[getDay(now)]}, ${format(now, "d 'de' MMMM", { locale: ptBR })}`}
        userName={session.user.name}
      />
      <ProductDashboardClient
        kpis={{ revenueToday, revenueYesterday, visitsToday, visitsYesterday, avgTicketToday, revenueWeek }}
        chartData={chartData}
        topProducts={topProducts}
        topCustomers={topCustomers}
        recentSales={recentSales}
        tenantLabel={tenantLabel}
      />
    </div>
  );
}
