import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPlan, PLAN_LIMITS } from "@/lib/billing";

function currentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const barbershopId = session.user.barbershopId;
  const yearMonth    = currentYearMonth();

  const plan = await getPlan(barbershopId);
  const limits = PLAN_LIMITS[plan.effectiveTier];

  // AI usage for current month
  const usage = await prisma.aiUsageMonth.findUnique({
    where: { barbershopId_yearMonth: { barbershopId, yearMonth } },
  });

  // AI call log (latest 20)
  const callLog = await prisma.aiCallLog.findMany({
    where:   { barbershopId },
    orderBy: { createdAt: "desc" },
    take:    20,
    select:  { id: true, feature: true, label: true, createdAt: true },
  });

  // Monthly usage history (last 6 months)
  const history = await prisma.aiUsageMonth.findMany({
    where:   { barbershopId, yearMonth: { not: "trialing", lt: yearMonth } },
    orderBy: { yearMonth: "desc" },
    take:    6,
    select:  { yearMonth: true, usageCount: true },
  });

  return NextResponse.json({
    yearMonth,
    subscription: {
      planTier:        plan.effectiveTier,
      priceCents:      plan.tier === "PRO" ? 4990 : 0,
      renewsAt:        plan.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: plan.cancelAtPeriodEnd,
    },
    aiUsage: {
      used:  usage?.usageCount ?? 0,
      limit: limits.aiPerPeriod === Infinity ? null : limits.aiPerPeriod,
    },
    credits: {
      balance:   plan.aiCreditBalance,
      purchased: plan.aiCreditsPurchased,
    },
    callLog: callLog.map((c) => ({
      id:        c.id,
      label:     c.label,
      createdAt: c.createdAt.toISOString(),
    })),
    history,
  });
}
