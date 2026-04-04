import { prisma } from "@/lib/prisma";
import { AiConfigClient } from "./ai-config-client";

const AI_CONFIG_KEYS = [
  "ai_image_model",
  "ai_image_size",
  "ai_image_quality",
  "ai_image_credit_cost",
  "ai_image_cost_usd_cents",
] as const;

const AI_CONFIG_DEFAULTS: Record<string, string> = {
  ai_image_model:          "gpt-image-1",
  ai_image_size:           "1024x1024",
  ai_image_quality:        "standard",
  ai_image_credit_cost:    "10",
  ai_image_cost_usd_cents: "4",
};

export default async function AdminAiConfigPage() {
  const rows = await prisma.platformConfig.findMany({
    where: { key: { in: [...AI_CONFIG_KEYS] } },
  });

  const current: Record<string, string> = {};
  for (const key of AI_CONFIG_KEYS) {
    current[key] = rows.find((r) => r.key === key)?.value ?? AI_CONFIG_DEFAULTS[key] ?? "";
  }

  return <AiConfigClient current={current} />;
}
