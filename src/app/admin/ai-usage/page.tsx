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

  // Build a map: barbershopId → current-month record (may not exist if no usage this month)
  const currentMonthMap = new Map(
    usages.filter((u) => u.yearMonth === yearMonth).map((u) => [u.barbershopId, u])
  );

  // Deduplicate: one row per barbershop, prefer current-month over trial
  const seen = new Set<string>();
  const deduped = usages.filter((u) => {
    if (seen.has(u.barbershopId)) return false;
    // If there's a current-month record for this barbershop, skip the trial record
    if (u.yearMonth === "trialing" && currentMonthMap.has(u.barbershopId)) return false;
    seen.add(u.barbershopId);
    return true;
  });

  const data = deduped.map((u) => {
    const sub       = u.barbershop.subscription;
    const tier      = (sub?.planTier ?? "FREE") as keyof typeof PLAN_LIMITS;
    const limit     = PLAN_LIMITS[tier]?.aiPerPeriod ?? 30;
    const isTrial   = sub?.status === "TRIALING";

    // For non-trial barbershops with only a trial record: show current month with 0 usage
    const effectiveYearMonth = (!isTrial && u.yearMonth === "trialing") ? yearMonth : u.yearMonth;
    const effectiveUsage     = (!isTrial && u.yearMonth === "trialing") ? 0 : u.usageCount;

    return {
      barbershopId:       u.barbershopId,
      barbershopName:     u.barbershop.name,
      yearMonth:          effectiveYearMonth,
      usageCount:         effectiveUsage,
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
