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

  // Deduplicate: prefer current-month record over "trialing" record per barbershop
  // Also skip "trialing" records for barbershops no longer on trial
  const seen = new Set<string>();
  const currentMonthRecords = usages.filter((u) => u.yearMonth === yearMonth);
  const trialRecords        = usages.filter((u) => u.yearMonth === "trialing");

  const deduped = [
    ...currentMonthRecords,
    ...trialRecords.filter((u) => {
      if (seen.has(u.barbershopId)) return false;
      // Only show trial record if the barbershop is still in trial
      return u.barbershop.subscription?.status === "TRIALING";
    }),
  ].filter((u) => {
    if (seen.has(u.barbershopId)) return false;
    seen.add(u.barbershopId);
    return true;
  });

  const data = deduped.map((u) => {
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
