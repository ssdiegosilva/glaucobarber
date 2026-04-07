import { prisma } from "@/lib/prisma";
import { AiUsageClient } from "./ai-usage-client";
import { PLAN_LIMITS, TRIAL_AI_LIMIT } from "@/lib/billing";

export default async function AdminAiUsagePage() {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Fetch all active barbershops + their AI usage for current month and trial
  const [barbershops, usages] = await Promise.all([
    prisma.barbershop.findMany({
      select: {
        id: true,
        name: true,
        subscription: {
          select: { planTier: true, status: true, aiCreditBalance: true, aiCreditsPurchased: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.aiUsageMonth.findMany({
      where: { yearMonth: { in: [yearMonth, "trialing"] } },
      select: { barbershopId: true, yearMonth: true, usageCount: true },
    }),
  ]);

  // Build usage maps
  const currentMonthUsage = new Map(
    usages.filter((u) => u.yearMonth === yearMonth).map((u) => [u.barbershopId, u.usageCount])
  );
  const trialUsage = new Map(
    usages.filter((u) => u.yearMonth === "trialing").map((u) => [u.barbershopId, u.usageCount])
  );

  const data = barbershops.map((shop) => {
    const sub     = shop.subscription;
    const tier    = (sub?.planTier ?? "FREE") as keyof typeof PLAN_LIMITS;
    const limit   = PLAN_LIMITS[tier]?.aiPerPeriod ?? 30;
    const isTrial = sub?.status === "TRIALING";

    const usageCount    = isTrial
      ? (trialUsage.get(shop.id) ?? 0)
      : (currentMonthUsage.get(shop.id) ?? 0);
    const effectiveYearMonth = isTrial ? "trialing" : yearMonth;

    return {
      barbershopId:       shop.id,
      barbershopName:     shop.name,
      yearMonth:          effectiveYearMonth,
      usageCount,
      planTier:           tier,
      planStatus:         sub?.status ?? "ACTIVE",
      planLimit:          limit === Infinity ? 9999 : limit,
      trialCap:           TRIAL_AI_LIMIT,
      aiCreditBalance:    sub?.aiCreditBalance    ?? 0,
      aiCreditsPurchased: sub?.aiCreditsPurchased ?? 0,
    };
  }).sort((a, b) => b.usageCount - a.usageCount);

  return <AiUsageClient data={data} yearMonth={yearMonth} />;
}
