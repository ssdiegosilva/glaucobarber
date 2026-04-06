import { prisma } from "@/lib/prisma";
import { AiUsageClient } from "./ai-usage-client";
import { PLAN_LIMITS, TRIAL_AI_LIMIT } from "@/lib/billing";

export default async function AdminAiUsagePage() {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;


  const usages = await prisma.aiUsageMonth.findMany({
    where: { yearMonth: { in: [yearMonth, "trialing"] } },
    include: {
      barbershop: {
        select: {
          id: true, name: true,
          subscription: {
            select: { planTier: true, status: true, aiCreditBalance: true, aiCreditsPurchased: true },
          },
        },
      },
    },
    orderBy: { usageCount: "desc" },
  });

  const data = usages.map((u) => {
    const sub    = u.barbershop.subscription;
    const tier   = (sub?.planTier ?? "FREE") as keyof typeof PLAN_LIMITS;
    const limit  = PLAN_LIMITS[tier]?.aiPerPeriod ?? 30;
    return {
      barbershopId:       u.barbershopId,
      barbershopName:     u.barbershop.name,
      yearMonth:          u.yearMonth,
      usageCount:         u.usageCount,
      planTier:           tier,
      planStatus:         sub?.status ?? "ACTIVE",
      planLimit:          limit === Infinity ? 9999 : limit,
      trialCap:           TRIAL_AI_LIMIT,
      aiCreditBalance:    sub?.aiCreditBalance    ?? 0,
      aiCreditsPurchased: sub?.aiCreditsPurchased ?? 0,
    };
  });

  return <AiUsageClient data={data} yearMonth={yearMonth} />;
}
