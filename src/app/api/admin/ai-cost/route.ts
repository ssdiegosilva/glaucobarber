import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const IMAGE_FEATURES = ["campaign_image", "visual_style_generate", "brand_style_logo"];

// Approximate monthly plan revenue in BRL cents (for profitability context)
const PLAN_REVENUE_CENTS: Record<string, number> = {
  FREE:       0,
  STARTER:    4990,
  PRO:        4990,
  ENTERPRISE: 0,
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now        = new Date();
  const yearMonth  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthStart = new Date(`${yearMonth}-01`);
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // ── Trial stats ─────────────────────────────────────────────────────────────
  const trialSubs = await prisma.platformSubscription.findMany({
    where:  { status: "TRIALING" },
    select: { barbershopId: true },
  });
  const trialIds = trialSubs.map((s) => s.barbershopId);

  const trialCostAgg = trialIds.length > 0
    ? await prisma.aiCallLog.aggregate({
        where:  { barbershopId: { in: trialIds } },
        _sum:   { costUsdCents: true },
        _count: { _all: true },
      })
    : { _sum: { costUsdCents: 0 }, _count: { _all: 0 } };

  const trialStats = {
    count:             trialIds.length,
    totalCostUsdCents: trialCostAgg._sum.costUsdCents ?? 0,
    avgCostUsdCents:   trialIds.length > 0
      ? Math.round((trialCostAgg._sum.costUsdCents ?? 0) / trialIds.length)
      : 0,
  };

  // ── Per-plan breakdown (all subs except platform admin) ─────────────────────
  const paidSubs = await prisma.platformSubscription.findMany({
    where:  { barbershop: { slug: { not: "__platform_admin__" } } },
    select: { barbershopId: true, planTier: true, status: true },
  });

  const costByShop = await prisma.aiCallLog.groupBy({
    by:    ["barbershopId"],
    where: { createdAt: { gte: monthStart, lt: monthEnd } },
    _sum:  { costUsdCents: true },
  });
  const costMap = new Map(costByShop.map((r) => [r.barbershopId, r._sum.costUsdCents ?? 0]));

  const tierMap = new Map<string, { shopIds: Set<string>; totalUsage: number; totalCostUsdCents: number }>();
  for (const sub of paidSubs) {
    const tier = sub.planTier;
    if (!tierMap.has(tier)) tierMap.set(tier, { shopIds: new Set(), totalUsage: 0, totalCostUsdCents: 0 });
    const entry = tierMap.get(tier)!;
    entry.shopIds.add(sub.barbershopId);
    entry.totalCostUsdCents += costMap.get(sub.barbershopId) ?? 0;
  }

  // Add usage counts from aiUsageMonth (all statuses including trialing)
  const monthUsages = await prisma.aiUsageMonth.findMany({
    where:  { yearMonth: { in: [yearMonth, "trialing"] } },
    select: { barbershopId: true, usageCount: true, yearMonth: true },
  });
  for (const u of monthUsages) {
    const sub = paidSubs.find((s) => s.barbershopId === u.barbershopId);
    if (!sub) continue;
    const entry = tierMap.get(sub.planTier);
    if (entry) entry.totalUsage += u.usageCount;
  }

  const planBreakdown = [...tierMap.entries()].map(([tier, data]) => {
    const activeSubs  = paidSubs.filter((s) => s.planTier === tier && s.status !== "TRIALING").length;
    const trialingSubs = paidSubs.filter((s) => s.planTier === tier && s.status === "TRIALING").length;
    return {
      tier,
      shopCount:             data.shopIds.size,
      activeSubs,
      trialingSubs,
      totalUsage:            data.totalUsage,
      estimatedCostUsdCents: data.totalCostUsdCents,
      planRevenueCents:      activeSubs * (PLAN_REVENUE_CENTS[tier] ?? 0),
    };
  }).sort((a, b) => b.planRevenueCents - a.planRevenueCents);

  // ── Image stats (current month) ──────────────────────────────────────────────
  const imageAgg = await prisma.aiCallLog.aggregate({
    where: {
      feature:   { in: IMAGE_FEATURES },
      createdAt: { gte: monthStart, lt: monthEnd },
    },
    _count: { _all: true },
    _sum:   { costUsdCents: true },
  });

  const imageStats = {
    count:             imageAgg._count._all,
    totalCostUsdCents: imageAgg._sum.costUsdCents ?? 0,
  };

  return NextResponse.json({ trialStats, planBreakdown, imageStats });
}
