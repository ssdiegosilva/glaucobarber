// ============================================================
// Cron: update-image-pricing
// Runs daily. Fetches USD/BRL exchange rate and recalculates
// gpt-image-1 credit costs with a 35% profit margin.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getKillSwitch } from "@/lib/platform-config";
import { after } from "next/server";

export const maxDuration = 60;

const MIN_MARGIN    = 0.35;
const CREDIT_BRL    = 0.10;
const FALLBACK_RATE = 5.80;

const OPENAI_COSTS_DEFAULTS = {
  low:    0.040,
  medium: 0.070,
  high:   0.190,
} as const;

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (await getKillSwitch("kill_image_pricing")) {
    return NextResponse.json({ skipped: true, reason: "kill_image_pricing active" });
  }

  after(async () => {
    const startedAt = Date.now();
    const run = await prisma.cronRun.create({ data: { cronName: "update-image-pricing", status: "running" } });

    try {
      const configs = await prisma.platformConfig.findMany({
        where: { key: { in: ["ai_image_profit_margin", "ai_image_openai_cost_low", "ai_image_openai_cost_medium", "ai_image_openai_cost_high"] } },
      });
      const cfg = Object.fromEntries(configs.map((c) => [c.key, c.value]));

      const configuredMargin = cfg["ai_image_profit_margin"] ? parseFloat(cfg["ai_image_profit_margin"]) / 100 : MIN_MARGIN;
      const MARGIN = Math.max(MIN_MARGIN, Math.min(0.90, configuredMargin));

      const OPENAI_COSTS = {
        low:    parseFloat(cfg["ai_image_openai_cost_low"]    ?? "") || OPENAI_COSTS_DEFAULTS.low,
        medium: parseFloat(cfg["ai_image_openai_cost_medium"] ?? "") || OPENAI_COSTS_DEFAULTS.medium,
        high:   parseFloat(cfg["ai_image_openai_cost_high"]   ?? "") || OPENAI_COSTS_DEFAULTS.high,
      };

      let usdBrl = FALLBACK_RATE;
      try {
        const rateRes = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(8000) });
        if (rateRes.ok) {
          const rateData = await rateRes.json();
          const rate = rateData?.rates?.BRL;
          if (typeof rate === "number" && rate > 0) usdBrl = rate;
        }
      } catch { /* fallback */ }

      const calc = (costUsd: number) => Math.ceil((costUsd * usdBrl) / (CREDIT_BRL * (1 - MARGIN)));
      const low = calc(OPENAI_COSTS.low), medium = calc(OPENAI_COSTS.medium), high = calc(OPENAI_COSTS.high);

      const upsert = (key: string, value: string) =>
        prisma.platformConfig.upsert({ where: { key }, update: { value }, create: { key, value } });

      await Promise.all([
        upsert("ai_image_credit_cost_low", String(low)),
        upsert("ai_image_credit_cost_medium", String(medium)),
        upsert("ai_image_credit_cost_high", String(high)),
        upsert("ai_image_credit_cost", String(medium)),
        upsert("ai_image_usd_brl_rate", usdBrl.toFixed(4)),
        upsert("ai_image_pricing_updated_at", new Date().toISOString()),
      ]);

      await prisma.cronRun.update({ where: { id: run.id }, data: { status: "success", durationMs: Date.now() - startedAt } });
    } catch (err) {
      await prisma.cronRun.update({ where: { id: run.id }, data: { status: "failed", durationMs: Date.now() - startedAt, error: String(err) } });
    }
  });

  return NextResponse.json({ date: new Date().toISOString(), accepted: true });
}
