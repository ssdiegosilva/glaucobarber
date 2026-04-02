import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth } from "date-fns";

const TOTAL_SLOTS_PER_DAY = 20;
const WORK_DAYS_PER_MONTH = 26; // approx (Mon–Sat)
const TOTAL_MONTHLY_SLOTS = TOTAL_SLOTS_PER_DAY * WORK_DAYS_PER_MONTH;

const MONTH_NAMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const barbershopId = session.user.barbershopId;
  const yearParam    = req.nextUrl.searchParams.get("year");
  const year         = yearParam ? parseInt(yearParam) : new Date().getFullYear();

  const months = await Promise.all(
    Array.from({ length: 12 }, async (_, i) => {
      const month     = i + 1;
      const monthStart = startOfMonth(new Date(year, i, 1));
      const monthEnd   = endOfMonth(new Date(year, i, 1));

      const agg = await prisma.appointment.groupBy({
        by: ["status"],
        where: { barbershopId, scheduledAt: { gte: monthStart, lte: monthEnd } },
        _count: { _all: true },
        _sum:   { price: true },
      });

      let totalCount     = 0;
      let completedCount = 0;
      let cancelledCount = 0;
      let noShowCount    = 0;
      let revenueCompleted  = 0;
      let revenueProjected  = 0;

      for (const row of agg) {
        totalCount += row._count._all;
        const rev  = Number(row._sum.price ?? 0);
        if (row.status === "COMPLETED") {
          completedCount  += row._count._all;
          revenueCompleted += rev;
        } else if (row.status === "CANCELLED") {
          cancelledCount += row._count._all;
        } else if (row.status === "NO_SHOW") {
          noShowCount += row._count._all;
        } else {
          // SCHEDULED | CONFIRMED | IN_PROGRESS → projected
          revenueProjected += rev;
        }
      }

      const activeCount   = totalCount - cancelledCount - noShowCount;
      const occupancyRate = Math.min(activeCount / TOTAL_MONTHLY_SLOTS, 1);
      const avgTicket     = completedCount > 0 ? revenueCompleted / completedCount : 0;
      const isPast        = new Date(year, i + 1, 0) < new Date();

      return {
        month,
        label:          MONTH_NAMES[i],
        totalCount,
        completedCount,
        cancelledCount,
        noShowCount,
        revenueCompleted,
        revenueProjected,
        occupancyRate,
        avgTicket,
        isPast,
      };
    })
  );

  return NextResponse.json({ year, months });
}
