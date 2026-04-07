import { prisma } from "@/lib/prisma";
import { AiConfigClient } from "./ai-config-client";

const AI_CONFIG_KEYS = [
  "ai_image_model",
  "ai_image_size",
  "ai_image_quality",
  "ai_image_credit_cost",
  "ai_image_cost_usd_cents",
  "ai_image_credit_cost_low",
  "ai_image_credit_cost_medium",
  "ai_image_credit_cost_high",
] as const;

const AI_CONFIG_DEFAULTS: Record<string, string> = {
  ai_image_model:              "gpt-image-1",
  ai_image_size:               "1024x1024",
  ai_image_quality:            "medium",
  ai_image_credit_cost:        "70",
  ai_image_cost_usd_cents:     "7",
  ai_image_credit_cost_low:    "40",
  ai_image_credit_cost_medium: "70",
  ai_image_credit_cost_high:   "190",
};

export default async function AdminAiConfigPage() {
  const rows = await prisma.platformConfig.findMany({
    where: { key: { in: [...AI_CONFIG_KEYS, "kill_image_generation"] } },
  });

  const current: Record<string, string> = {};
  for (const key of AI_CONFIG_KEYS) {
    current[key] = rows.find((r) => r.key === key)?.value ?? AI_CONFIG_DEFAULTS[key] ?? "";
  }

  const killImageGeneration = rows.find((r) => r.key === "kill_image_generation")?.value === "true";

  return <AiConfigClient current={current} killImageGeneration={killImageGeneration} />;
}
