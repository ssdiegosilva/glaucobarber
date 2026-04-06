import { prisma } from "@/lib/prisma";

// ── AI Image Config ────────────────────────────────────────────────────────────

export interface AiImageConfig {
  model:        "gpt-image-1" | "dall-e-3" | "dall-e-2";
  size:         "1024x1024" | "512x512" | "256x256";
  quality:      "standard" | "hd";
  creditCost:   number;  // credits charged to user per image generation
  costUsdCents: number;  // actual platform cost in USD cents (e.g. 4 = $0.04)
}

const AI_IMAGE_DEFAULTS: AiImageConfig = {
  model:        "gpt-image-1",
  size:         "1024x1024",
  quality:      "standard",
  creditCost:   10,
  costUsdCents: 4,
};

export async function getAiImageConfig(): Promise<AiImageConfig> {
  const rows = await prisma.platformConfig.findMany({
    where: {
      key: { in: ["ai_image_model", "ai_image_size", "ai_image_quality", "ai_image_credit_cost", "ai_image_cost_usd_cents"] },
    },
  });
  const get = (k: string) => rows.find((r) => r.key === k)?.value;
  return {
    model:        (get("ai_image_model")   as AiImageConfig["model"])   ?? AI_IMAGE_DEFAULTS.model,
    size:         (get("ai_image_size")    as AiImageConfig["size"])    ?? AI_IMAGE_DEFAULTS.size,
    quality:      (get("ai_image_quality") as AiImageConfig["quality"]) ?? AI_IMAGE_DEFAULTS.quality,
    creditCost:   parseInt(get("ai_image_credit_cost")    ?? "") || AI_IMAGE_DEFAULTS.creditCost,
    costUsdCents: parseInt(get("ai_image_cost_usd_cents") ?? "") || AI_IMAGE_DEFAULTS.costUsdCents,
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
  | "kill_whatsapp_auto"
  | "kill_trinks_sync"
  | "kill_new_signups";

/**
 * Returns true if the kill switch is active (value === "true").
 * Defaults to false (not killed) if the key doesn't exist.
 */
export async function getKillSwitch(key: KillSwitchKey): Promise<boolean> {
  const row = await prisma.platformConfig.findUnique({ where: { key } });
  return row?.value === "true";
}
