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

  // During trial: unlimited AI (no tracking)
  if (plan.status === "TRIALING") {
    return { allowed: true, used: 0, limit: Infinity, creditsRemaining: 0, planTier: plan.tier };
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

// ── consumeAiCredit ────────────────────────────────────────────────────────────

export async function consumeAiCredit(barbershopId: string): Promise<void> {
  const plan   = await getPlan(barbershopId);
  const limits = PLAN_LIMITS[plan.tier];

  // During trial: unlimited, nothing to track
  if (plan.status === "TRIALING") return;

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
