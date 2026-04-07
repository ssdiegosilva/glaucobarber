import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVerticalConfig } from "@/lib/core/vertical";
import { getKillSwitch } from "@/lib/platform-config";
import type { PlanTier, SubscriptionStatus } from "@prisma/client";

// ── Plan limits (reads feature gates from vertical config) ────────────────────

function buildPlanLimits() {
  const v = getVerticalConfig();
  return {
    FREE:       { aiPerPeriod: 0,        periodType: "trial"   as const, featureGates: v.billing.featureGates["FREE"]       ?? [] },
    STARTER:    { aiPerPeriod: 300,      periodType: "monthly" as const, featureGates: [] },
    PRO:        { aiPerPeriod: 300,      periodType: "monthly" as const, featureGates: v.billing.featureGates["PRO"]        ?? [] },
    ENTERPRISE: { aiPerPeriod: Infinity, periodType: "monthly" as const, featureGates: v.billing.featureGates["ENTERPRISE"] ?? [] },
  } satisfies Record<PlanTier, { aiPerPeriod: number; periodType: "trial" | "monthly"; featureGates: string[] }>;
}

export const PLAN_LIMITS: Record<
  PlanTier,
  {
    aiPerPeriod:  number;
    periodType:   "trial" | "monthly";
    featureGates: string[];
  }
> = buildPlanLimits();

// Limite de segurança do trial (invisível para o usuário)
export const TRIAL_AI_LIMIT = 50;

// ── Helpers ────────────────────────────────────────────────────────────────────

function currentYearMonth(): string {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function periodKey(tier: PlanTier): string {
  return PLAN_LIMITS[tier].periodType === "trial" ? "trial" : currentYearMonth();
}

// ── getPlan ────────────────────────────────────────────────────────────────────

export interface PlanInfo {
  tier:                PlanTier;
  effectiveTier:       PlanTier;   // = "PRO" during TRIALING (full access), same as tier otherwise
  status:              SubscriptionStatus;
  aiCreditBalance:     number;
  aiCreditsPurchased:  number;
  stripeSubId:         string | null;
  stripeCustomerId:    string | null;
  trialEndsAt:         Date | null;
  currentPeriodEnd:    Date | null;
  cancelAtPeriodEnd:   boolean;
}

export async function getPlan(barbershopId: string): Promise<PlanInfo> {
  let sub = await prisma.platformSubscription.findUnique({
    where:   { barbershopId },
    include: { barbershop: { select: { stripeCustomerId: true } } },
  });

  // Lazy creation for new barbershops — start on a 7-day trial
  if (!sub) {
    const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    sub = await prisma.platformSubscription.upsert({
      where:  { barbershopId },
      create: {
        barbershopId,
        planTier:           "FREE",
        status:             "TRIALING",
        trialEndsAt:        trialEnd,
        currentPeriodStart: new Date(),
        currentPeriodEnd:   trialEnd,
      },
      update: {},
      include: { barbershop: { select: { stripeCustomerId: true } } },
    });
  }

  // Real-time trial expiry check (cron runs daily but we enforce immediately)
  if (sub.status === "TRIALING" && sub.trialEndsAt && sub.trialEndsAt < new Date()) {
    await prisma.platformSubscription.update({
      where: { barbershopId },
      data:  { status: "ACTIVE", planTier: "FREE", currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) },
    });
    sub = { ...sub, status: "ACTIVE", planTier: "FREE" };
  }

  // During trial, effective tier = PRO (full feature access)
  const safeTier: PlanTier      = (sub.planTier in PLAN_LIMITS ? sub.planTier : "FREE") as PlanTier;
  const effectiveTier: PlanTier = sub.status === "TRIALING" ? "PRO" : safeTier;

  return {
    tier:                safeTier,
    effectiveTier,
    status:              sub.status,
    aiCreditBalance:     sub.aiCreditBalance,
    aiCreditsPurchased:  sub.aiCreditsPurchased,
    stripeSubId:         sub.stripeSubId ?? null,
    stripeCustomerId:    sub.barbershop.stripeCustomerId ?? null,
    trialEndsAt:         sub.trialEndsAt ?? null,
    currentPeriodEnd:    sub.currentPeriodEnd ?? null,
    cancelAtPeriodEnd:   sub.cancelAtPeriodEnd,
  };
}

// ── hasFeature ─────────────────────────────────────────────────────────────────

export function hasFeature(tier: PlanTier, feature: string): boolean {
  return !PLAN_LIMITS[tier].featureGates.includes(feature);
}

// ── checkAiAllowance ───────────────────────────────────────────────────────────

export interface AiAllowance {
  allowed:          boolean;
  used:             number;
  limit:            number;
  creditsRemaining: number;
  planTier:         PlanTier;
  planStatus:       SubscriptionStatus;
}

export async function checkAiAllowance(barbershopId: string): Promise<AiAllowance> {
  if (await getKillSwitch("kill_ai_global")) {
    const plan = await getPlan(barbershopId);
    return { allowed: false, used: 0, limit: 0, creditsRemaining: 0, planTier: plan.tier, planStatus: plan.status };
  }

  const plan   = await getPlan(barbershopId);
  const limits = PLAN_LIMITS[plan.tier];

  // During trial: 300-call safety cap (invisible to user — not shown in UI)
  if (plan.status === "TRIALING") {
    const usage = await prisma.aiUsageMonth.findUnique({
      where: { barbershopId_yearMonth: { barbershopId, yearMonth: "trialing" } },
    });
    const used    = usage?.usageCount ?? 0;
    const allowed = used < TRIAL_AI_LIMIT;
    return { allowed, used, limit: TRIAL_AI_LIMIT, creditsRemaining: plan.aiCreditBalance, planTier: plan.tier, planStatus: plan.status };
  }

  if (limits.aiPerPeriod === Infinity) {
    return { allowed: true, used: 0, limit: Infinity, creditsRemaining: 0, planTier: plan.tier, planStatus: plan.status };
  }

  const key   = periodKey(plan.tier);
  const usage = await prisma.aiUsageMonth.findUnique({
    where: { barbershopId_yearMonth: { barbershopId, yearMonth: key } },
  });

  const used             = usage?.usageCount ?? 0;
  const baseAllowance    = limits.aiPerPeriod;
  const creditsRemaining = plan.aiCreditBalance;
  // Correct check: within base plan OR has extra credits remaining.
  // (Don't add creditsRemaining to totalAllowance — credits are already being
  //  decremented from aiCreditBalance as they're consumed, so comparing
  //  `used < base + remaining` double-counts and blocks valid credit usage.)
  const allowed = used < baseAllowance || creditsRemaining > 0;

  return {
    allowed,
    used,
    limit:  baseAllowance,
    creditsRemaining,
    planTier:   plan.tier,
    planStatus: plan.status,
  };
}

// ── Feature credit costs (reads from vertical config) ─────────────────────────

export const AI_FEATURE_COSTS: Record<string, number> = getVerticalConfig().ai.featureCosts;

export function getFeatureCost(feature: string): number {
  return AI_FEATURE_COSTS[feature] ?? 1;
}

// ── Feature labels for AI call log (reads from vertical config) ───────────────

export const AI_FEATURE_LABELS: Record<string, string> = getVerticalConfig().ai.featureLabels;

// Max AI call log entries kept per barbershop
const AI_CALL_LOG_MAX = 50;

// ── Standard AI limit error (use in route handlers) ───────────────────────────

export const AI_LIMIT_ERROR = {
  error:      "ai_limit_reached",
  message:    "Limite de IA atingido. Adicione créditos para continuar.",
  upgradeUrl: "/billing",
} as const;

// ── withAiCredit — wraps check + AI operation + consume in one call ───────────
// Usage in route handlers:
//   const outcome = await withAiCredit(barbershopId, "feature", async () => {
//     return await someAiOperation();
//   });
//   if (!outcome.ok) return outcome.response;   // 402 limit response
//   const { result } = outcome;

export async function withAiCredit<T>(
  barbershopId: string,
  feature: string,
  fn: () => Promise<T>,
): Promise<{ ok: false; response: NextResponse } | { ok: true; result: T }> {
  const { allowed } = await checkAiAllowance(barbershopId);
  if (!allowed) {
    return {
      ok: false,
      response: NextResponse.json(AI_LIMIT_ERROR, { status: 402 }),
    };
  }
  const result = await fn();
  await consumeAiCredit(barbershopId, feature);
  return { ok: true, result };
}

// ── consumeAiCredit ────────────────────────────────────────────────────────────

// Estimated GPT-4o-mini costs per feature in USD cents
// Based on: input $0.15/1M tokens + output $0.60/1M tokens
const TEXT_FEATURE_COST_USD_CENTS: Record<string, number> = {
  copilot_chat:         0.08, // ~2000 input + 800 output
  campaign_text:        0.04, // ~800 input + 300 output
  campaign_themes:      0.10, // web search + ~1500 tokens
  ai_suggestion:        0.05, // ~1500 input + 400 output
  post_sale:            0.02, // ~600 input + 200 output
  whatsapp_template:    0.03, // ~800 input + 300 output
  whatsapp_personalize: 0.02, // ~500 input + 200 output
  goals_suggest:        0.04, // ~1000 input + 400 output
  price_recommend:      0.03, // ~800 input + 300 output
  brand_style_improve:  0.02, // ~400 input + 150 output
  brand_style_logo:     0.04, // vision model ~1000 input
  visual_style_analyze: 0.04, // vision model ~1000 input
  opportunities:        0.04, // ~1200 input + 400 output
};

const IMAGE_FEATURES = new Set(getVerticalConfig().ai.imageFeatures);

export async function consumeAiCredit(
  barbershopId: string,
  feature: string,
  overrides?: { credits?: number; usdCents?: number },
): Promise<void> {
  const plan   = await getPlan(barbershopId);
  const limits = PLAN_LIMITS[plan.tier];

  // Determine credit cost and actual USD cost — image features read live from PlatformConfig
  let cost: number;
  let costUsdCents: number;

  if (overrides?.credits !== undefined) {
    // Caller provides explicit values (e.g. quality-tier-specific pricing)
    cost         = overrides.credits;
    costUsdCents = overrides.usdCents ?? 0;
  } else if (IMAGE_FEATURES.has(feature)) {
    const cfgs = await prisma.platformConfig.findMany({
      where: { key: { in: ["ai_image_credit_cost", "ai_image_cost_usd_cents"] } },
    });
    const get = (k: string, def: number) => parseInt(cfgs.find((c) => c.key === k)?.value ?? "") || def;
    cost         = get("ai_image_credit_cost",    AI_FEATURE_COSTS[feature] ?? 10);
    costUsdCents = get("ai_image_cost_usd_cents", 4);
  } else {
    cost         = getFeatureCost(feature);
    // GPT-4o-mini estimated costs in USD cents (input $0.15/1M + output $0.60/1M)
    costUsdCents = TEXT_FEATURE_COST_USD_CENTS[feature] ?? 0.03;
  }

  // Log this call with actual USD cost
  await logAiCall(barbershopId, feature, costUsdCents);

  // During trial: track against the 300-call safety cap under key "trialing"
  if (plan.status === "TRIALING") {
    const updated = await prisma.aiUsageMonth.upsert({
      where:  { barbershopId_yearMonth: { barbershopId, yearMonth: "trialing" } },
      create: { barbershopId, yearMonth: "trialing", usageCount: cost },
      update: { usageCount: { increment: cost } },
    });

    // Crossed the limit on this call → migrate to FREE and notify
    if (updated.usageCount >= TRIAL_AI_LIMIT) {
      await prisma.platformSubscription.updateMany({
        where: { barbershopId, status: "TRIALING" },
        data:  { status: "ACTIVE", planTier: "FREE", currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) },
      });
      // Create notification (idempotent: only if none of this type exists yet)
      const existing = await prisma.systemNotification.findFirst({
        where: { barbershopId, type: "TRIAL_QUOTA_EXCEEDED", dismissed: false },
      });
      if (!existing) {
        await prisma.systemNotification.create({
          data: {
            barbershopId,
            type:  "TRIAL_QUOTA_EXCEEDED",
            title: "Trial encerrado",
            body:  "Você utilizou todos os créditos disponíveis no período de teste. Assine um plano para continuar usando a IA.",
          },
        });
      }
    }
    return;
  }

  if (limits.aiPerPeriod === Infinity) return;

  const key = periodKey(plan.tier);

  // Increment usage counter
  const updated = await prisma.aiUsageMonth.upsert({
    where:  { barbershopId_yearMonth: { barbershopId, yearMonth: key } },
    create: { barbershopId, yearMonth: key, usageCount: cost },
    update: { usageCount: { increment: cost } },
  });

  // If we've exceeded the base limit, burn from credit balance
  if (updated.usageCount > limits.aiPerPeriod && plan.aiCreditBalance > 0) {
    await prisma.platformSubscription.update({
      where: { barbershopId },
      data:  { aiCreditBalance: { decrement: cost } },
    });
  }
}

// ── logAiCall ──────────────────────────────────────────────────────────────────

async function logAiCall(barbershopId: string, feature: string, costUsdCents = 0): Promise<void> {
  const label = AI_FEATURE_LABELS[feature] ?? feature;

  await prisma.aiCallLog.create({
    data: { barbershopId, feature, label, costUsdCents },
  });

  // Keep only the last AI_CALL_LOG_MAX entries per barbershop
  const toKeep = await prisma.aiCallLog.findMany({
    where:   { barbershopId },
    orderBy: { createdAt: "desc" },
    take:    AI_CALL_LOG_MAX,
    select:  { id: true },
  });

  if (toKeep.length === AI_CALL_LOG_MAX) {
    await prisma.aiCallLog.deleteMany({
      where: { barbershopId, id: { notIn: toKeep.map((r) => r.id) } },
    });
  }
}

