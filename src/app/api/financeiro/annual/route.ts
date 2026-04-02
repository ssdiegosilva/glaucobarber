import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfYear, endOfYear, format } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const barbershopId = session.user.barbershopId;
  const yearParam = req.nextUrl.searchParams.get("year");
  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();

  const yearStart = startOfYear(new Date(year, 0, 1));
  const yearEnd   = endOfYear(new Date(year, 0, 1));

  const [appointments, goals] = await Promise.all([
    prisma.appointment.findMany({
      where: { barbershopId, status: "COMPLETED", scheduledAt: { gte: yearStart, lte: yearEnd } },
      select: { scheduledAt: true, price: true },
    }),
    prisma.goal.findMany({
      where: { barbershopId, year },
      select: { month: true, revenueTarget: true },
    }),
  ]);

  // Build monthly revenue map
  const revenueByMonth = new Map<number, number>();
  const countByMonth   = new Map<number, number>();
  for (const a of appointments) {
    const m = a.scheduledAt.getMonth() + 1;
    revenueByMonth.set(m, (revenueByMonth.get(m) ?? 0) + Number(a.price ?? 0));
    countByMonth.set(m, (countByMonth.get(m) ?? 0) + 1);
  }

  const goalByMonth = new Map(goals.map((g) => [g.month, Number(g.revenueTarget ?? 0)]));

  const months = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return {
      month:   m,
      label:   format(new Date(year, i, 1), "MMM"),
      revenue: revenueByMonth.get(m) ?? 0,
      count:   countByMonth.get(m) ?? 0,
      goal:    goalByMonth.get(m) ?? null,
    };
  });

  const totalRevenue = months.reduce((s, m) => s + m.revenue, 0);
  const totalCount   = months.reduce((s, m) => s + m.count, 0);

  return NextResponse.json({ year, months, totalRevenue, totalCount });
}
