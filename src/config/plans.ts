// Plan feature definitions — source of truth for UI and billing logic.
// For enforcement logic see src/lib/billing.ts (PLAN_LIMITS).

export const PLAN_FEATURES = {
  FREE: {
    ai_calls_per_period:    30,           // lifetime, never resets
    ai_period:              "lifetime" as const,
    financeiro:             true,         // unlocked on trial
    campaigns:              true,
    offers:                 true,
    sync_manual:            true,
    sync_auto:              false,
    appointment_fee_brl:    0,
    monthly_brl:            0,
  },
  STARTER: {
    ai_calls_per_period:    50,           // per month
    ai_period:              "monthly" as const,
    financeiro:             false,        // LOCKED
    campaigns:              true,
    offers:                 true,
    sync_manual:            true,
    sync_auto:              false,
    appointment_fee_brl:    0,
    monthly_brl:            89,
  },
  PRO: {
    ai_calls_per_period:    300,          // per month
    ai_period:              "monthly" as const,
    financeiro:             true,
    campaigns:              true,
    offers:                 true,
    sync_manual:            true,
    sync_auto:              true,
    appointment_fee_brl:    1.50,         // R$1,50 per completed appointment (cap R$400/month)
    monthly_brl:            149,
  },
  ENTERPRISE: {
    ai_calls_per_period:    Infinity,
    ai_period:              "monthly" as const,
    financeiro:             true,
    campaigns:              true,
    offers:                 true,
    sync_manual:            true,
    sync_auto:              true,
    appointment_fee_brl:    0,
    monthly_brl:            0,            // custom pricing
  },
} as const;

export const AI_CREDITS_PACK = {
  calls:    60,
  price_brl: 29,
} as const;
