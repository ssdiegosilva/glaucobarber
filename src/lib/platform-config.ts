import { prisma } from "@/lib/prisma";

// ── AI Image Config ────────────────────────────────────────────────────────────

export interface AiImageConfig {
  model:        "gpt-image-1" | "gpt-image-1.5" | "gpt-image-1-mini";
  size:         "1024x1024";
  quality:      "low" | "medium" | "high" | "standard" | "hd";
  creditCost:   number;  // legacy / fallback — base credit cost
  costUsdCents: number;  // actual platform cost in USD cents (e.g. 7 = $0.07)
  // Per-quality-tier credit costs (shown to user in quality selector)
  creditCostLow:    number;
  creditCostMedium: number;
  creditCostHigh:   number;
}

const AI_IMAGE_DEFAULTS: AiImageConfig = {
  model:           "gpt-image-1",
  size:            "1024x1024",
  quality:         "medium",
  creditCost:      70,
  costUsdCents:    7,
  creditCostLow:   40,
  creditCostMedium:70,
  creditCostHigh:  190,
};

export type ImageQualityTier = "low" | "medium" | "high";

/** Maps user-facing quality tier to the actual API quality param for each model */
export function tierToApiQuality(tier: ImageQualityTier, model: string): string {
  return tier; // gpt-image-1 / gpt-image-1.5 / gpt-image-1-mini: low / medium / high
}

/** Returns the USD cost in cents for a given tier + model (used for logging) */
export function tierToUsdCents(tier: ImageQualityTier, model: string): number {
  if (model === "gpt-image-1-mini") {
    if (tier === "low")  return 2;
    if (tier === "high") return 10;
    return 3; // medium
  }
  // gpt-image-1 / gpt-image-1.5
  if (tier === "low")    return 4;
  if (tier === "high")   return 19;
  return 7; // medium
}

export async function getAiImageConfig(): Promise<AiImageConfig> {
  const rows = await prisma.platformConfig.findMany({
    where: {
      key: { in: [
        "ai_image_model", "ai_image_quality",
        "ai_image_credit_cost", "ai_image_cost_usd_cents",
        "ai_image_credit_cost_low", "ai_image_credit_cost_medium", "ai_image_credit_cost_high",
      ]},
    },
  });
  const get = (k: string) => rows.find((r) => r.key === k)?.value;
  const int = (k: string, def: number) => parseInt(get(k) ?? "") || def;
  return {
    model:           (get("ai_image_model")   as AiImageConfig["model"])   ?? AI_IMAGE_DEFAULTS.model,
    size:            "1024x1024" as const,
    quality:         (get("ai_image_quality") as AiImageConfig["quality"]) ?? AI_IMAGE_DEFAULTS.quality,
    creditCost:      int("ai_image_credit_cost",         AI_IMAGE_DEFAULTS.creditCost),
    costUsdCents:    int("ai_image_cost_usd_cents",       AI_IMAGE_DEFAULTS.costUsdCents),
    creditCostLow:   int("ai_image_credit_cost_low",     AI_IMAGE_DEFAULTS.creditCostLow),
    creditCostMedium:int("ai_image_credit_cost_medium",  AI_IMAGE_DEFAULTS.creditCostMedium),
    creditCostHigh:  int("ai_image_credit_cost_high",    AI_IMAGE_DEFAULTS.creditCostHigh),
  };
}

/**
 * Reads a Stripe price ID from PlatformConfig (admin-managed).
 * Falls back to the env var if not set in DB.
 */
export async function getStripePrice(
  key: "stripe_price_starter_monthly" | "stripe_price_pro_monthly" | "stripe_price_enterprise_monthly" | "stripe_price_ai_credits_pack",
  envFallback?: string,
): Promise<string> {
  const row = await prisma.platformConfig.findUnique({ where: { key } });
  return row?.value || envFallback || "";
}

/**
 * Reads multiple price IDs in one DB round-trip.
 */
export async function getStripePrices(
  keys: ("stripe_price_starter_monthly" | "stripe_price_pro_monthly" | "stripe_price_enterprise_monthly" | "stripe_price_ai_credits_pack")[],
): Promise<Record<string, string>> {
  const rows = await prisma.platformConfig.findMany({ where: { key: { in: keys } } });
  const map: Record<string, string> = {};
  for (const key of keys) {
    map[key] = rows.find((r) => r.key === key)?.value ?? "";
  }
  return map;
}

// ── Kill Switches ──────────────────────────────────────────────────────────────

export type KillSwitchKey =
  | "kill_ai_global"
  | "kill_image_generation"
  | "kill_whatsapp_auto"
  | "kill_trinks_sync"
  | "kill_new_signups"
  | "kill_image_pricing"
  | "kill_vitrine";

/**
 * Returns true if the kill switch is active (value === "true").
 * Defaults to false (not killed) if the key doesn't exist.
 */
export async function getKillSwitch(key: KillSwitchKey): Promise<boolean> {
  const row = await prisma.platformConfig.findUnique({ where: { key } });
  return row?.value === "true";
}
