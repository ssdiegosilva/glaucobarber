import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  const mm  = String(now.getMonth() + 1).padStart(2, "0");
  const yearMonth = `${now.getFullYear()}-${mm}`;
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalShops,
    planBreakdown,
    aiToday,
    aiThisMonth,
    billingThisMonth,
    newShopsThisWeek,
  ] = await Promise.all([
    prisma.barbershop.count({ where: { slug: { not: "__platform_admin__" } } }),
    prisma.platformSubscription.groupBy({ by: ["planTier", "status"], _count: { _all: true } }),
    prisma.aiUsageMonth.aggregate({ where: { updatedAt: { gte: todayStart } }, _sum: { usageCount: true } }),
    prisma.aiUsageMonth.aggregate({ where: { yearMonth }, _sum: { usageCount: true } }),
    prisma.billingEvent.aggregate({ where: { yearMonth, invoicedAt: null }, _sum: { amountCents: true }, _count: { _all: true } }),
    prisma.barbershop.count({ where: { createdAt: { gte: weekAgo }, slug: { not: "__platform_admin__" } } }),
  ]);

  return NextResponse.json({
    totalShops,
    planBreakdown,
    aiToday: aiToday._sum.usageCount ?? 0,
    aiThisMonth: aiThisMonth._sum.usageCount ?? 0,
    billingPendingCents: billingThisMonth._sum.amountCents ?? 0,
    billingPendingCount: billingThisMonth._count._all,
    newShopsThisWeek,
  });
}
