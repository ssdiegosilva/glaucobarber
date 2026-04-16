// ============================================================
// Daily Cron – runs at 06:00 every day
// - Data cleanup: WhatsApp (10d), AuditLog (90d), Suggestion/Action (90d), SyncRun (180d), AiCallLog (keep 30)
// - Trial expiration: TRIALING → FREE after trialEndsAt
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { after } from "next/server";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  after(async () => {
    const start   = Date.now();
    const cronRun = await prisma.cronRun.create({ data: { cronName: "daily", status: "running" } });

    try {
      const now = new Date();
      const ago = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      await prisma.whatsappMessage.deleteMany({ where: { createdAt: { lt: ago(10) }, status: "SENT" } });
      await prisma.whatsappMessage.deleteMany({ where: { createdAt: { lt: ago(1) }, status: "FAILED" } });
      await prisma.auditLog.deleteMany({ where: { createdAt: { lt: ago(90) } } });
      await prisma.suggestion.deleteMany({ where: { createdAt: { lt: ago(90) }, status: { in: ["DISMISSED"] } } });
      await prisma.action.deleteMany({ where: { createdAt: { lt: ago(90) }, status: { in: ["DISMISSED", "EXECUTED"] } } });
      await prisma.syncRun.deleteMany({ where: { startedAt: { lt: ago(180) } } });
      await prisma.systemNotification.deleteMany({ where: { createdAt: { lt: ago(30) } } });
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

      // Trial expiration
      const expiredTrials = await prisma.platformSubscription.findMany({
        where: { status: "TRIALING", trialEndsAt: { lt: now } },
        select: { barbershopId: true },
      });

      if (expiredTrials.length > 0) {
        const expiredIds = expiredTrials.map((t) => t.barbershopId);
        await prisma.platformSubscription.updateMany({
          where: { barbershopId: { in: expiredIds } },
          data: { status: "ACTIVE", planTier: "FREE", currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) },
        });
        for (const barbershopId of expiredIds) {
          const already = await prisma.systemNotification.findFirst({ where: { barbershopId, type: "TRIAL_EXPIRED", dismissed: false } });
          if (!already) {
            await prisma.systemNotification.create({
              data: { barbershopId, type: "TRIAL_EXPIRED", title: "Período de trial encerrado", body: "Seu trial gratuito expirou. Você agora está no plano Free. Assine um plano para continuar com acesso completo à IA." },
            });
          }
        }
      }

      await prisma.cronRun.update({ where: { id: cronRun.id }, data: { status: "success", durationMs: Date.now() - start } });
    } catch (err) {
      await prisma.cronRun.update({ where: { id: cronRun.id }, data: { status: "failed", durationMs: Date.now() - start, error: String(err) } });
    }
  });

  return NextResponse.json({ date: new Date().toISOString(), accepted: true });
}
