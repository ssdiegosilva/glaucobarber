import { prisma } from "@/lib/prisma";
import { StripeConfigClient } from "./stripe-config-client";

const CONFIG_KEYS = [
  "stripe_price_starter_monthly",
  "stripe_price_pro_monthly",
  "stripe_price_enterprise_monthly",
  "stripe_price_ai_credits_pack",
] as const;

export default async function AdminStripePage() {
  const rows = await prisma.platformConfig.findMany({
    where: { key: { in: [...CONFIG_KEYS] } },
  });

  const current: Record<string, string> = {};
  for (const key of CONFIG_KEYS) {
    current[key] = rows.find((r) => r.key === key)?.value
      ?? process.env[key.toUpperCase().replace(/-/g, "_")] ?? "";
  }

  return <StripeConfigClient current={current} />;
}
