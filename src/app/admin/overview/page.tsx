import { prisma } from "@/lib/prisma";
import { OverviewClient } from "./overview-client";

export default async function AdminOverviewPage() {
  const now      = new Date();
  const mm       = String(now.getMonth() + 1).padStart(2, "0");
  const yearMonth = `${now.getFullYear()}-${mm}`;
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const ago24h     = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const ago25h     = new Date(Date.now() - 25 * 60 * 60 * 1000);
  const in3days    = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  const [
    platformConfigs,
    cronRuns,
    waQueued,
    waFailed,
    campaignsScheduled,
    syncFailures,
    totalShops,
    trialing,
    aiToday,
    aiThisMonth,
    trialsExpiringSoon,
    aiUsagesThisMonth,
    pricingConfigs,
  ] = await Promise.all([
    prisma.platformConfig.findMany({
      where: { key: { in: ["kill_ai_global", "kill_image_generation", "kill_whatsapp_auto", "kill_trinks_sync", "kill_new_signups", "kill_image_pricing", "kill_vitrine"] } },
    }),
    // Last run per cron — distinct by cronName
    prisma.cronRun.findMany({
      orderBy: { ranAt: "desc" },
      take:    40, // enough to cover all crons with some history
    }),
    prisma.whatsappMessage.count({ where: { status: "QUEUED" } }),
    prisma.whatsappMessage.count({ where: { status: "FAILED", createdAt: { gte: ago24h } } }),
    prisma.campaign.count({ where: { status: "SCHEDULED" } }),
    prisma.syncRun.findMany({
      where: { startedAt: { gte: ago24h }, status: { in: ["FAILED", "PARTIAL"] } },
      include: { barbershop: { select: { name: true } } },
      orderBy: { startedAt: "desc" },
      take: 20,
    }),
    prisma.barbershop.count({ where: { slug: { not: "__platform_admin__" } } }),
    prisma.platformSubscription.count({ where: { status: "TRIALING" } }),
    prisma.aiUsageMonth.aggregate({ where: { updatedAt: { gte: todayStart } }, _sum: { usageCount: true } }),
    prisma.aiUsageMonth.aggregate({ where: { yearMonth }, _sum: { usageCount: true } }),
    prisma.platformSubscription.findMany({
      where: { status: "TRIALING", trialEndsAt: { lte: in3days, gte: now } },
      include: { barbershop: { select: { name: true } } },
      orderBy: { trialEndsAt: "asc" },
    }),
    prisma.aiUsageMonth.findMany({
      where: { yearMonth },
      include: { barbershop: { select: { name: true, subscription: { select: { planTier: true } } } } },
    }),
    prisma.platformConfig.findMany({
      where: { key: { in: ["ai_image_usd_brl_rate", "ai_image_pricing_updated_at", "ai_image_pricing_rate_source", "ai_image_credit_cost_low", "ai_image_credit_cost_medium", "ai_image_credit_cost_high"] } },
    }),
  ]);

  // Get last run per cron name
  const CRON_NAMES = ["daily", "hourly-sync", "whatsapp-send", "campaigns-publish", "vitrine-publish", "update-image-pricing"];
  const lastCronRun = CRON_NAMES.map((name) => {
    const run = cronRuns.find((r) => r.cronName === name);
    return {
      name,
      status:     run?.status ?? null,
      ranAt:      run?.ranAt?.toISOString() ?? null,
      durationMs: run?.durationMs ?? null,
      error:      run?.error ?? null,
      isLate:     run ? run.ranAt < ago25h : true,
    };
  });

  // Kill switches (default false if not in DB)
  const killMap = Object.fromEntries(platformConfigs.map((c) => [c.key, c.value === "true"]));
  const killSwitches = {
    kill_ai_global:        killMap["kill_ai_global"]        ?? false,
    kill_image_generation: killMap["kill_image_generation"] ?? false,
    kill_whatsapp_auto:    killMap["kill_whatsapp_auto"]    ?? false,
    kill_trinks_sync:      killMap["kill_trinks_sync"]      ?? false,
    kill_new_signups:      killMap["kill_new_signups"]      ?? false,
    kill_image_pricing:    killMap["kill_image_pricing"]    ?? false,
    kill_vitrine:          killMap["kill_vitrine"]          ?? false,
  };

  // Plan limits for 80% threshold check
  const MONTHLY_LIMITS: Record<string, number> = { FREE: 30, STARTER: 200, PRO: 1000, ENTERPRISE: 999999 };
  const nearLimit = aiUsagesThisMonth
    .filter((u) => {
      const tier  = u.barbershop.subscription?.planTier ?? "FREE";
      const limit = MONTHLY_LIMITS[tier] ?? 30;
      return u.usageCount >= limit * 0.8 && limit < 999999;
    })
    .map((u) => ({
      barbershopId:   u.barbershopId,
      barbershopName: u.barbershop.name,
      usageCount:     u.usageCount,
      limit:          MONTHLY_LIMITS[u.barbershop.subscription?.planTier ?? "FREE"] ?? 30,
    }));

  const pricingMap = Object.fromEntries(pricingConfigs.map((c) => [c.key, c.value]));
  const imagePricing = {
    usdBrl:     pricingMap["ai_image_usd_brl_rate"]      ? parseFloat(pricingMap["ai_image_usd_brl_rate"])      : null,
    rateSource: pricingMap["ai_image_pricing_rate_source"] ?? null,
    updatedAt:  pricingMap["ai_image_pricing_updated_at"]  ?? null,
    credits: pricingMap["ai_image_credit_cost_low"] ? {
      low:    parseInt(pricingMap["ai_image_credit_cost_low"]),
      medium: parseInt(pricingMap["ai_image_credit_cost_medium"]),
      high:   parseInt(pricingMap["ai_image_credit_cost_high"]),
    } : null,
  };

  return (
    <OverviewClient
      killSwitches={killSwitches}
      cronRuns={lastCronRun}
      imagePricing={imagePricing}
      queues={{
        waQueued,
        waFailed,
        campaignsScheduled,
        syncFailures: syncFailures.map((s) => ({
          id:            s.id,
          barbershopName: s.barbershop.name,
          status:         s.status,
          errorsCount:    s.errorsCount,
          startedAt:      s.startedAt.toISOString(),
        })),
      }}
      metrics={{
        totalShops,
        trialing,
        aiToday:      aiToday._sum.usageCount    ?? 0,
        aiThisMonth:  aiThisMonth._sum.usageCount ?? 0,
        trialsExpiringSoon: trialsExpiringSoon.map((t) => ({
          barbershopId:   t.barbershopId,
          barbershopName: t.barbershop.name,
          trialEndsAt:    t.trialEndsAt!.toISOString(),
        })),
        nearLimit,
      }}
    />
  );
}
