import { prisma } from "@/lib/prisma";
import { AiUsageClient } from "./ai-usage-client";
import { PLAN_LIMITS } from "@/lib/billing";

export default async function AdminAiUsagePage() {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const usages = await prisma.aiUsageMonth.findMany({
    where: { yearMonth: { in: [yearMonth, "trial"] } },
    include: {
      barbershop: {
        select: { id: true, name: true, subscription: { select: { planTier: true, aiCreditBalance: true } } },
      },
    },
    orderBy: { usageCount: "desc" },
  });

  const data = usages.map((u) => {
    const tier   = (u.barbershop.subscription?.planTier ?? "FREE") as keyof typeof PLAN_LIMITS;
    const limit  = PLAN_LIMITS[tier]?.aiPerPeriod ?? 30;
    return {
      barbershopId:   u.barbershopId,
      barbershopName: u.barbershop.name,
      yearMonth:      u.yearMonth,
      usageCount:     u.usageCount,
      planTier:       tier,
      limit:          limit === Infinity ? 9999 : limit,
      aiCredits:      u.barbershop.subscription?.aiCreditBalance ?? 0,
    };
  });

  return <AiUsageClient data={data} yearMonth={yearMonth} />;
}
