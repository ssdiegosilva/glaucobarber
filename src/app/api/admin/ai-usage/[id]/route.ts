import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PLAN_LIMITS } from "@/lib/billing";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: barbershopId } = await params;
  const { searchParams } = new URL(req.url);
  const now = new Date();
  const defaultYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const yearMonth = searchParams.get("yearMonth") ?? defaultYm;

  const [barbershop, usageMonths, callLogs] = await Promise.all([
    prisma.barbershop.findUnique({
      where: { id: barbershopId },
      select: {
        id: true,
        name: true,
        subscription: { select: { planTier: true, aiCreditBalance: true } },
      },
    }),
    prisma.aiUsageMonth.findMany({
      where: { barbershopId },
      orderBy: { yearMonth: "desc" },
      take: 12,
    }),
    prisma.aiCallLog.findMany({
      where: { barbershopId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  if (!barbershop) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tier = (barbershop.subscription?.planTier ?? "FREE") as keyof typeof PLAN_LIMITS;
  const limit = PLAN_LIMITS[tier]?.aiPerPeriod ?? 30;

  // Current month usage
  const currentMonthUsage = usageMonths.find((u) => u.yearMonth === yearMonth)?.usageCount ?? 0;

  // Feature breakdown from call logs
  const featureMap: Record<string, { count: number; totalCostUsdCents: number; label: string }> = {};
  for (const log of callLogs) {
    if (!featureMap[log.feature]) {
      featureMap[log.feature] = { count: 0, totalCostUsdCents: 0, label: log.label };
    }
    featureMap[log.feature].count += 1;
    featureMap[log.feature].totalCostUsdCents += log.costUsdCents;
  }
  const byFeature = Object.entries(featureMap)
    .map(([feature, v]) => ({ feature, ...v }))
    .sort((a, b) => b.count - a.count);

  const totalCostUsdCents = callLogs.reduce((s, l) => s + l.costUsdCents, 0);

  return NextResponse.json({
    barbershop: {
      id:              barbershop.id,
      name:            barbershop.name,
      planTier:        tier,
      aiCreditBalance: barbershop.subscription?.aiCreditBalance ?? 0,
    },
    currentMonth: {
      yearMonth,
      usageCount:       currentMonthUsage,
      limit:            limit === Infinity ? null : limit,
    },
    months:    usageMonths.map((u) => ({ yearMonth: u.yearMonth, usageCount: u.usageCount })),
    byFeature,
    recentLogs: callLogs.map((l) => ({
      id:             l.id,
      feature:        l.feature,
      label:          l.label,
      costUsdCents:   l.costUsdCents,
      createdAt:      l.createdAt,
    })),
    totalCostUsdCents,
    logsAvailable: callLogs.length,
  });
}
