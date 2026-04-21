import { requireBarbershop } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { ProductDashboardClient } from "../dashboard/product-dashboard-client";
import { getSegmentTheme } from "@/lib/core/segment";
import { format, getDay, startOfWeek, startOfDay, endOfDay, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const DAY_ABBR  = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default async function DashboardVendasPage() {
  const session = await requireBarbershop();
  const barbershopId = session.user.barbershopId;
  const now = new Date();

  const segmentTheme = await getSegmentTheme(barbershopId);

  const todayStart     = startOfDay(now);
  const todayEnd       = endOfDay(now);
  const yesterdayStart = startOfDay(subDays(now, 1));
  const yesterdayEnd   = endOfDay(subDays(now, 1));
  const weekStart      = startOfWeek(now, { weekStartsOn: 1 });
  const thirtyDaysAgo  = subDays(now, 30);
  const sevenDaysAgo   = startOfDay(subDays(now, 6));

  const [
    todayAgg,
    yesterdayAgg,
    weekAgg,
    last7DaysVisits,
    todayVisits,
    topProductsRaw,
    topCustomersRaw,
  ] = await Promise.all([
    prisma.visit.aggregate({
      where: { barbershopId, visitedAt: { gte: todayStart, lte: todayEnd } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.visit.aggregate({
      where: { barbershopId, visitedAt: { gte: yesterdayStart, lte: yesterdayEnd } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.visit.aggregate({
      where: { barbershopId, visitedAt: { gte: weekStart, lte: todayEnd } },
      _sum: { amount: true },
    }),
    prisma.visit.findMany({
      where: { barbershopId, visitedAt: { gte: sevenDaysAgo, lte: todayEnd } },
      select: { visitedAt: true, amount: true },
    }),
    prisma.visit.findMany({
      where: { barbershopId, visitedAt: { gte: todayStart, lte: todayEnd } },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        items: { select: { name: true, quantity: true, price: true } },
      },
      orderBy: { visitedAt: "desc" },
      take: 50,
    }),
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

  const topProducts = topProductsRaw.map((p) => ({
    name:     p.name,
    quantity: Number(p.total_qty),
    revenue:  Number(p.total_revenue),
  }));

  const topCustomers = topCustomersRaw.map((c) => ({
    id:         c.id,
    name:       c.name,
    visitCount: Number(c.visit_count),
    totalSpent: Number(c.total_spent),
    phone:      c.phone,
  }));

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
        title="Vendas"
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
