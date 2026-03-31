// ============================================================
// Daily Cron – runs at 08:00 every day (configured in vercel.json)
// Generates AI suggestions for all active barbershops
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAIProvider, buildAIContext, saveAISuggestions } from "@/lib/ai/provider";

export async function GET(req: NextRequest) {
  // Verify cron secret
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const provider = getAIProvider();

  // Find all active barbershops with AI enabled
  const barbershops = await prisma.barbershop.findMany({
    where: {
      subscription: { status: { in: ["ACTIVE", "TRIALING"] } },
    },
    include: {
      featureFlags: { where: { flag: "ai_suggestions", enabled: true } },
    },
  });

  const results = [];

  for (const shop of barbershops) {
    if (shop.featureFlags.length === 0) continue;

    try {
      const context     = await buildAIContext(shop.id);
      const suggestions = await provider.generateSuggestions(context);
      await saveAISuggestions(shop.id, suggestions, context);

      await prisma.auditLog.create({
        data: {
          barbershopId: shop.id,
          action:       "cron.ai.suggestions",
          entity:       "Suggestion",
          metadata:     JSON.stringify({ count: suggestions.length }),
        },
      });

      results.push({ barbershopId: shop.id, count: suggestions.length, ok: true });
    } catch (err) {
      results.push({ barbershopId: shop.id, error: String(err), ok: false });
    }
  }

  return NextResponse.json({
    date:    new Date().toISOString(),
    results,
    total:   results.length,
  });
}
