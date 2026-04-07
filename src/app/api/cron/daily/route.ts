// ============================================================
// Daily Cron – runs at 06:00 every day (configured in vercel.json)
// - Data cleanup: WhatsApp (10d), AuditLog (90d), Suggestion/Action (90d), SyncRun (180d), AiCallLog (keep 30)
// - Trial expiration: TRIALING → FREE after trialEndsAt
// - AI suggestions: generates for all active barbershops
// - On the 1st of the month: runs monthly billing for PRO plans
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

  const start    = Date.now();
  const cronRun  = await prisma.cronRun.create({
    data: { cronName: "daily", status: "running" },
  });

  const provider = getAIProvider();

  // ── Data cleanup ─────────────────────────────────────────────────────────────
  const now = new Date();
  const ago = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // WhatsApp messages: SENT kept 10 days, FAILED purged after 1 day
  await prisma.whatsappMessage.deleteMany({
    where: { createdAt: { lt: ago(10) }, status: "SENT" },
  });
  await prisma.whatsappMessage.deleteMany({
    where: { createdAt: { lt: ago(1) }, status: "FAILED" },
  });

  // AuditLog: 90 days
  await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: ago(90) } },
  });

  // AI suggestions: 90 days for dismissed/executed (active ones kept)
  await prisma.suggestion.deleteMany({
    where: { createdAt: { lt: ago(90) }, status: { in: ["DISMISSED"] } },
  });

  // Actions (copilot): 90 days for dismissed/executed
  await prisma.action.deleteMany({
    where: { createdAt: { lt: ago(90) }, status: { in: ["DISMISSED", "EXECUTED"] } },
  });

  // SyncRun logs: 180 days
  await prisma.syncRun.deleteMany({
    where: { startedAt: { lt: ago(180) } },
  });

  // SystemNotification: 30 days (dismissed or not)
  await prisma.systemNotification.deleteMany({
    where: { createdAt: { lt: ago(30) } },
  });

  // AiCallLog: keep only last 30 per barbershop (safety net — normally enforced on insert)
  // We purge per-barbershop using a raw query for efficiency
  await prisma.$executeRaw`
    DELETE FROM ai_call_logs
    WHERE id NOT IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY "barbershopId" ORDER BY "createdAt" DESC) AS rn
        FROM ai_call_logs
      ) ranked
      WHERE rn <= 30
    )
  `;

  // ── Trial expiration: TRIALING → FREE ────────────────────────────────────────
  // Barbershops whose trial ended become FREE (30 lifetime AI calls)
  const expiredTrials = await prisma.platformSubscription.findMany({
    where: { status: "TRIALING", trialEndsAt: { lt: now } },
    select: { barbershopId: true },
  });

  if (expiredTrials.length > 0) {
    const expiredIds = expiredTrials.map((t) => t.barbershopId);
    await prisma.platformSubscription.updateMany({
      where: { barbershopId: { in: expiredIds } },
      data: {
        status:           "ACTIVE",
        planTier:         "FREE",
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });

    // Notify each shop (skip if already notified)
    for (const barbershopId of expiredIds) {
      const already = await prisma.systemNotification.findFirst({
        where: { barbershopId, type: "TRIAL_EXPIRED", dismissed: false },
      });
      if (!already) {
        await prisma.systemNotification.create({
          data: {
            barbershopId,
            type:  "TRIAL_EXPIRED",
            title: "Período de trial encerrado",
            body:  "Seu trial gratuito expirou. Você agora está no plano Free. Assine um plano para continuar com acesso completo à IA.",
          },
        });
      }
    }
  }

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
      console.error(`[cron/daily] ai suggestions error for ${shop.id}:`, err);
      await prisma.auditLog.create({
        data: {
          barbershopId: shop.id,
          action:       "cron.ai.suggestions.error",
          entity:       "Suggestion",
          metadata:     JSON.stringify({ error: String(err) }),
        },
      }).catch(() => {});
      results.push({ barbershopId: shop.id, error: String(err), ok: false });
    }
  }

  await prisma.cronRun.update({
    where: { id: cronRun.id },
    data: { status: "success", durationMs: Date.now() - start },
  });

  return NextResponse.json({
    date:    new Date().toISOString(),
    results,
    total:   results.length,
  });
}
