import { prisma } from "@/lib/prisma";
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
  FREE:       { aiPerPeriod: 30,       periodType: "trial",   featureGates: [],             appointmentFee: false },
  STARTER:    { aiPerPeriod: 50,       periodType: "monthly", featureGates: ["financeiro"], appointmentFee: false },
  PRO:        { aiPerPeriod: 300,      periodType: "monthly", featureGates: [],             appointmentFee: true  },
  ENTERPRISE: { aiPerPeriod: Infinity, periodType: "monthly", featureGates: [],             appointmentFee: false },
};

// Limite de segurança do trial (invisível para o usuário)
export const TRIAL_AI_LIMIT = 300;

// R$1,50 por atendimento concluído no plano PRO
export const APPOINTMENT_FEE_CENTS = 150;
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
  tier:              PlanTier;
  effectiveTier:     PlanTier;   // = "PRO" during TRIALING, same as tier otherwise
  status:            SubscriptionStatus;
  aiCreditBalance:   number;
  stripeSubId:       string | null;
  stripeCustomerId:  string | null;
  trialEndsAt:       Date | null;
  currentPeriodEnd:  Date | null;
  cancelAtPeriodEnd: boolean;
}

export async function getPlan(barbershopId: string): Promise<PlanInfo> {
  let sub = await prisma.platformSubscription.findUnique({
    where:   { barbershopId },
    include: { barbershop: { select: { stripeCustomerId: true } } },
  });

  // Lazy creation for barbershops that pre-date the billing system
  if (!sub) {
    sub = await prisma.platformSubscription.upsert({
      where:  { barbershopId },
      create: {
        barbershopId,
        planTier:           "FREE",
        status:             "ACTIVE",
        currentPeriodStart: new Date(),
        currentPeriodEnd:   new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
      update: {},
      include: { barbershop: { select: { stripeCustomerId: true } } },
    });
  }

  // During trial, effective tier = PRO (full feature access)
  const effectiveTier: PlanTier = sub.status === "TRIALING" ? "PRO" : sub.planTier;

  return {
    tier:              sub.planTier,
    effectiveTier,
    status:            sub.status,
    aiCreditBalance:   sub.aiCreditBalance,
    stripeSubId:       sub.stripeSubId ?? null,
    stripeCustomerId:  sub.barbershop.stripeCustomerId ?? null,
    trialEndsAt:       sub.trialEndsAt ?? null,
    currentPeriodEnd:  sub.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
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
    return { allowed, used, limit: TRIAL_AI_LIMIT, creditsRemaining: 0, planTier: plan.tier };
  }

  if (limits.aiPerPeriod === Infinity) {
    return { allowed: true, used: 0, limit: Infinity, creditsRemaining: 0, planTier: plan.tier };
  }

  const key   = periodKey(plan.tier);
  const usage = await prisma.aiUsageMonth.findUnique({
    where: { barbershopId_yearMonth: { barbershopId, yearMonth: key } },
  });

  const used             = usage?.usageCount ?? 0;
  const baseAllowance    = limits.aiPerPeriod;
  const creditsRemaining = plan.aiCreditBalance;
  const totalAllowance   = baseAllowance + creditsRemaining;
  const allowed          = used < totalAllowance;

  return {
    allowed,
    used,
    limit:  baseAllowance,
    creditsRemaining,
    planTier: plan.tier,
  };
}

// ── Feature labels for AI call log ────────────────────────────────────────────

export const AI_FEATURE_LABELS: Record<string, string> = {
  copilot_chat:     "Chat com Copilot",
  goals_suggest:    "Sugestão de Meta",
  post_sale:        "Mensagem Pós-venda",
  ai_suggestion:    "Sugestão do Copilot",
  price_recommend:  "Recomendação de Preço",
  opportunities:    "Oportunidades de Serviço",
  campaign_image:   "Imagem de Campanha",
};

// Max AI call log entries kept per barbershop
const AI_CALL_LOG_MAX = 30;

// ── consumeAiCredit ────────────────────────────────────────────────────────────

export async function consumeAiCredit(barbershopId: string, feature: string): Promise<void> {
  const plan   = await getPlan(barbershopId);
  const limits = PLAN_LIMITS[plan.tier];

  // Log this call (async, fire-and-forget style but awaited for safety)
  await logAiCall(barbershopId, feature);

  // During trial: track against the 300-call safety cap under key "trialing"
  if (plan.status === "TRIALING") {
    const updated = await prisma.aiUsageMonth.upsert({
      where:  { barbershopId_yearMonth: { barbershopId, yearMonth: "trialing" } },
      create: { barbershopId, yearMonth: "trialing", usageCount: 1 },
      update: { usageCount: { increment: 1 } },
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
    create: { barbershopId, yearMonth: key, usageCount: 1 },
    update: { usageCount: { increment: 1 } },
  });

  // If we've exceeded the base limit, burn from credit balance
  if (updated.usageCount > limits.aiPerPeriod && plan.aiCreditBalance > 0) {
    await prisma.platformSubscription.update({
      where: { barbershopId },
      data:  { aiCreditBalance: { decrement: 1 } },
    });
  }
}

// ── logAiCall ──────────────────────────────────────────────────────────────────

async function logAiCall(barbershopId: string, feature: string): Promise<void> {
  const label = AI_FEATURE_LABELS[feature] ?? feature;

  await prisma.aiCallLog.create({
    data: { barbershopId, feature, label },
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

  const yearMonth = currentYearMonth();

  // Check monthly cap: sum of uninvoiced + already invoiced this month
  const monthTotal = await prisma.billingEvent.aggregate({
    where:  { barbershopId, yearMonth },
    _sum:   { amountCents: true },
  });

  const totalSoFar = monthTotal._sum.amountCents ?? 0;
  if (totalSoFar >= APPOINTMENT_FEE_CAP_CENTS) return; // cap reached

  // Idempotent upsert: won't duplicate if called twice
  await prisma.billingEvent.upsert({
    where:  { appointmentId },
    create: { barbershopId, appointmentId, yearMonth, amountCents: APPOINTMENT_FEE_CENTS },
    update: {}, // already exists → no-op
  });
}
