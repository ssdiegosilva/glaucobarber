import { prisma } from "@/lib/prisma";

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
