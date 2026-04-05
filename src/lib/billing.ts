import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import type { PlanTier, SubscriptionStatus } from "@prisma/client";

// ── Plan limits ────────────────────────────────────────────────────────────────

export const PLAN_LIMITS: Record<
  PlanTier,
  {
    aiPerPeriod:   number;            // Infinity = unlimited
    periodType:    "trial" | "monthly";
    featureGates:  string[];          // feature keys locked on this plan
    appointmentFee: boolean;          // charges per completed appointment
  }
> = {
  FREE:       { aiPerPeriod: 30,       periodType: "trial",   featureGates: ["financeiro", "meta", "whatsapp_auto"], appointmentFee: false },
  STARTER:    { aiPerPeriod: 200,      periodType: "monthly", featureGates: ["financeiro", "whatsapp_auto"],          appointmentFee: false },
  PRO:        { aiPerPeriod: 1000,     periodType: "monthly", featureGates: [],             appointmentFee: true  },
  ENTERPRISE: { aiPerPeriod: Infinity, periodType: "monthly", featureGates: [],             appointmentFee: false },
};

// Limite de segurança do trial (invisível para o usuário)
export const TRIAL_AI_LIMIT = 50;

// R$1,00 por atendimento concluído no plano PRO
export const APPOINTMENT_FEE_CENTS = 100;
// Cap: máximo R$400 em taxas de atendimento/mês (total PRO = R$149 + R$400 = R$549)
export const APPOINTMENT_FEE_CAP_CENTS = 40_000;

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
  limit:            number;      // base limit (not counting credits)
  creditsRemaining: number;
  planTier:         PlanTier;
  planStatus:       SubscriptionStatus;
}

export async function checkAiAllowance(barbershopId: string): Promise<AiAllowance> {
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

// ── Feature credit costs (weighted — image costs more than text) ───────────────

export const AI_FEATURE_COSTS: Record<string, number> = {
  campaign_image:        10,
  visual_style_generate: 10,
  brand_style_logo:      10,
  // everything else defaults to 1
};

export function getFeatureCost(feature: string): number {
  return AI_FEATURE_COSTS[feature] ?? 1;
}

// ── Feature labels for AI call log ────────────────────────────────────────────

export const AI_FEATURE_LABELS: Record<string, string> = {
  copilot_chat:          "Chat com Copilot",
  goals_suggest:         "Sugestão de Meta",
  post_sale:             "Mensagem Pós-venda",
  ai_suggestion:         "Sugestão do Copilot",
  price_recommend:       "Recomendação de Preço",
  opportunities:         "Oportunidades de Serviço",
  campaign_image:        "Imagem de Campanha",
  campaign_text:         "Texto de Campanha",
  campaign_themes:       "Temas de Campanha",
  brand_style_improve:   "Identidade Visual (texto)",
  brand_style_logo:      "Identidade Visual (logo)",
  visual_style_analyze:  "Criar Visual (análise)",
  visual_style_generate: "Criar Visual (geração)",
  whatsapp_template:     "Template de WhatsApp",
  whatsapp_personalize:  "Mensagem WhatsApp (IA)",
};

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

const IMAGE_FEATURES = new Set(["campaign_image", "visual_style_generate", "brand_style_logo"]);

export async function consumeAiCredit(barbershopId: string, feature: string): Promise<void> {
  const plan   = await getPlan(barbershopId);
  const limits = PLAN_LIMITS[plan.tier];

  // Determine credit cost and actual USD cost — image features read live from PlatformConfig
  let cost: number;
  let costUsdCents: number;

  if (IMAGE_FEATURES.has(feature)) {
    const cfgs = await prisma.platformConfig.findMany({
      where: { key: { in: ["ai_image_credit_cost", "ai_image_cost_usd_cents"] } },
    });
    const get = (k: string, def: number) => parseInt(cfgs.find((c) => c.key === k)?.value ?? "") || def;
    cost         = get("ai_image_credit_cost",    AI_FEATURE_COSTS[feature] ?? 10);
    costUsdCents = get("ai_image_cost_usd_cents", 4);
  } else {
    cost         = getFeatureCost(feature);
    costUsdCents = 0;
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

// ── createAppointmentBillingEvent ──────────────────────────────────────────────

export async function createAppointmentBillingEvent(
  barbershopId:  string,
  appointmentId: string,
): Promise<void> {
  const plan = await getPlan(barbershopId);
  if (!PLAN_LIMITS[plan.tier].appointmentFee) return;

  // Read configurable fee values from DB, fallback to code constants
  const feeConfigs = await prisma.platformConfig.findMany({
    where: { key: { in: ["pro_appointment_fee_cents", "pro_appointment_fee_cap_cents"] } },
  });
  const feeCents    = parseInt(feeConfigs.find((c) => c.key === "pro_appointment_fee_cents")?.value    ?? "") || APPOINTMENT_FEE_CENTS;
  const feeCap      = parseInt(feeConfigs.find((c) => c.key === "pro_appointment_fee_cap_cents")?.value ?? "") || APPOINTMENT_FEE_CAP_CENTS;

  const yearMonth = currentYearMonth();

  // Check monthly cap: sum of uninvoiced + already invoiced this month
  const monthTotal = await prisma.billingEvent.aggregate({
    where:  { barbershopId, yearMonth },
    _sum:   { amountCents: true },
  });

  const totalSoFar = monthTotal._sum.amountCents ?? 0;
  if (totalSoFar >= feeCap) return; // cap reached

  // Idempotent upsert: won't duplicate if called twice
  const result = await prisma.billingEvent.upsert({
    where:  { appointmentId },
    create: { barbershopId, appointmentId, yearMonth, amountCents: feeCents },
    update: {}, // already exists → no-op
    select: { id: true, createdAt: true },
  });

  // Only report to Stripe on first creation (createdAt = now, not older)
  const isNew = Date.now() - result.createdAt.getTime() < 5_000;
  if (!isNew) return;

  // Report metered usage to Stripe Meters API
  const barbershop = await prisma.barbershop.findUnique({
    where:  { id: barbershopId },
    select: { stripeCustomerId: true },
  });

  if (barbershop?.stripeCustomerId) {
    try {
      await (stripe.billing as any).meterEvents.create({
        event_name: "atendimentos_pro",
        payload: {
          stripe_customer_id: barbershop.stripeCustomerId,
          value: "1",
        },
      });
    } catch (err) {
      console.error("[Stripe Meter] Failed to report usage:", err);
    }
  }
}
