import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfYear, endOfYear, format } from "date-fns";

async function getAnnualData(barbershopId: string, year: number) {
  const yearStart = startOfYear(new Date(year, 0, 1));
  const yearEnd   = endOfYear(new Date(year, 0, 1));

  const [appointments, goals, cancelled] = await Promise.all([
    prisma.appointment.findMany({
      where: { barbershopId, status: "COMPLETED", scheduledAt: { gte: yearStart, lte: yearEnd } },
      select: { scheduledAt: true, price: true },
    }),
    prisma.goal.findMany({
      where: { barbershopId, year },
      select: { month: true, revenueTarget: true },
    }),
    prisma.appointment.groupBy({
      by: ["scheduledAt"],
      where: { barbershopId, status: { in: ["CANCELLED", "NO_SHOW"] }, scheduledAt: { gte: yearStart, lte: yearEnd } },
      _count: { _all: true },
    }),
  ]);

  const revenueByMonth   = new Map<number, number>();
  const countByMonth     = new Map<number, number>();
  for (const a of appointments) {
    const m = a.scheduledAt.getMonth() + 1;
    revenueByMonth.set(m, (revenueByMonth.get(m) ?? 0) + Number(a.price ?? 0));
    countByMonth.set(m, (countByMonth.get(m) ?? 0) + 1);
  }

  const cancelledByMonth = new Map<number, number>();
  for (const c of cancelled) {
    const m = new Date(c.scheduledAt).getMonth() + 1;
    cancelledByMonth.set(m, (cancelledByMonth.get(m) ?? 0) + (c._count._all));
  }

  const goalByMonth = new Map(goals.map((g) => [g.month, Number(g.revenueTarget ?? 0)]));

  const months = Array.from({ length: 12 }, (_, i) => {
    const m       = i + 1;
    const revenue = revenueByMonth.get(m) ?? 0;
    const count   = countByMonth.get(m) ?? 0;
    return {
      month:          m,
      label:          format(new Date(year, i, 1), "MMM"),
      revenue,
      count,
      avgTicket:      count > 0 ? revenue / count : 0,
      goal:           goalByMonth.get(m) ?? null,
      cancelledCount: cancelledByMonth.get(m) ?? 0,
    };
  });

  const totalRevenue = months.reduce((s, m) => s + m.revenue, 0);
  const totalCount   = months.reduce((s, m) => s + m.count, 0);

  return { year, months, totalRevenue, totalCount };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const barbershopId    = session.user.barbershopId;
  const yearParam       = req.nextUrl.searchParams.get("year");
  const includePrevYear = req.nextUrl.searchParams.get("includePrevYear") === "true";
  const year            = yearParam ? parseInt(yearParam) : new Date().getFullYear();

  const [current, prev] = await Promise.all([
    getAnnualData(barbershopId, year),
    includePrevYear ? getAnnualData(barbershopId, year - 1) : Promise.resolve(null),
  ]);

  return NextResponse.json({
    ...current,
    prevYear: prev ? { totalRevenue: prev.totalRevenue, totalCount: prev.totalCount, months: prev.months } : null,
  });
}
