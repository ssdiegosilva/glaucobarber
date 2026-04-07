// ============================================================
// Cron: update-image-pricing
// Runs daily. Fetches USD/BRL exchange rate and recalculates
// gpt-image-1 credit costs with a 35% profit margin.
//
// Credit pack: R$20 = 200 credits → 1 credit = R$0.10
// Formula: ceil(openai_cost_usd × usd_brl / (0.10 × (1 - 0.35)))
// Margin 35% means profit = 35% of selling price → price = cost / 0.65
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MIN_MARGIN    = 0.35;         // never below 35% profit margin
const CREDIT_BRL    = 0.10;         // R$0.10 per credit (R$20 / 200)
const FALLBACK_RATE = 5.80;         // fallback if exchange API is down

// gpt-image-1 1024×1024 default costs in USD — overridden by PlatformConfig
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

  const startedAt = Date.now();
  const run = await prisma.cronRun.create({
    data: { cronName: "update-image-pricing", status: "running" },
  });

  try {
    // ── 0. Read configured margin + OpenAI costs from DB ──────
    const configs = await prisma.platformConfig.findMany({
      where: { key: { in: [
        "ai_image_profit_margin",
        "ai_image_openai_cost_low",
        "ai_image_openai_cost_medium",
        "ai_image_openai_cost_high",
      ]}},
    });
    const cfg = Object.fromEntries(configs.map((c) => [c.key, c.value]));

    const configuredMargin = cfg["ai_image_profit_margin"] ? parseFloat(cfg["ai_image_profit_margin"]) / 100 : MIN_MARGIN;
    const MARGIN = Math.max(MIN_MARGIN, Math.min(0.90, configuredMargin));

    const OPENAI_COSTS = {
      low:    parseFloat(cfg["ai_image_openai_cost_low"]    ?? "") || OPENAI_COSTS_DEFAULTS.low,
      medium: parseFloat(cfg["ai_image_openai_cost_medium"] ?? "") || OPENAI_COSTS_DEFAULTS.medium,
      high:   parseFloat(cfg["ai_image_openai_cost_high"]   ?? "") || OPENAI_COSTS_DEFAULTS.high,
    };

    // ── 1. Fetch USD/BRL exchange rate ─────────────────────────
    let usdBrl = FALLBACK_RATE;
    let rateSource = "fallback";

    try {
      const rateRes = await fetch("https://open.er-api.com/v6/latest/USD", {
        signal: AbortSignal.timeout(8000),
      });
      if (rateRes.ok) {
        const rateData = await rateRes.json();
        const rate = rateData?.rates?.BRL;
        if (typeof rate === "number" && rate > 0) {
          usdBrl = rate;
          rateSource = "open.er-api.com";
        }
      }
    } catch {
      // fallback to hardcoded rate — log but don't fail
      console.warn("[update-image-pricing] Exchange rate fetch failed, using fallback:", FALLBACK_RATE);
    }

    // ── 2. Calculate credit costs ──────────────────────────────
    // Margem de lucro real: lucro = 35% do preço de venda
    // preço_brl = custo_brl / (1 - margem)
    // créditos = ceil(preço_brl / valor_por_crédito)
    const calc = (costUsd: number) =>
      Math.ceil((costUsd * usdBrl) / (CREDIT_BRL * (1 - MARGIN)));

    const low    = calc(OPENAI_COSTS.low);
    const medium = calc(OPENAI_COSTS.medium);
    const high   = calc(OPENAI_COSTS.high);

    // ── 3. Persist to PlatformConfig ──────────────────────────
    const upsert = (key: string, value: string) =>
      prisma.platformConfig.upsert({
        where:  { key },
        update: { value },
        create: { key, value },
      });

    await Promise.all([
      upsert("ai_image_credit_cost_low",      String(low)),
      upsert("ai_image_credit_cost_medium",   String(medium)),
      upsert("ai_image_credit_cost_high",     String(high)),
      upsert("ai_image_credit_cost",          String(medium)),  // default = medium
      upsert("ai_image_usd_brl_rate",         usdBrl.toFixed(4)),
      upsert("ai_image_pricing_updated_at",   new Date().toISOString()),
      upsert("ai_image_pricing_rate_source",  rateSource),
    ]);

    const durationMs = Date.now() - startedAt;
    await prisma.cronRun.update({
      where: { id: run.id },
      data:  { status: "success", durationMs },
    });

    return NextResponse.json({
      ok:         true,
      usdBrl,
      rateSource,
      credits:    { low, medium, high },
      margin:     `${Math.round(MARGIN * 100)}% (sobre o preço de venda)`,
      durationMs,
    });

  } catch (err) {
    const durationMs = Date.now() - startedAt;
    await prisma.cronRun.update({
      where: { id: run.id },
      data:  { status: "failed", durationMs, error: String(err) },
    });
    throw err;
  }
}
