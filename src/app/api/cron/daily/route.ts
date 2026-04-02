// ============================================================
// Daily Cron – runs at 06:00 every day (configured in vercel.json)
// - Generates AI suggestions for all active barbershops
// - On the 1st of the month: runs monthly billing for PRO plans
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAIProvider, buildAIContext, saveAISuggestions } from "@/lib/ai/provider";
import { stripe } from "@/lib/stripe";

export async function GET(req: NextRequest) {
  // Verify cron secret
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const provider = getAIProvider();

  // Cleanup: remove WhatsApp messages older than 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await prisma.whatsappMessage.deleteMany({
    where: { createdAt: { lt: sevenDaysAgo }, status: { in: ["SENT", "FAILED"] } },
  });

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

  // ── Monthly billing (runs only on the 1st of the month) ───────────────────
  let billingResult: { invoiced: number; errors: string[] } | null = null;

  if (new Date().getDate() === 1) {
    const now       = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const yyyy      = prevMonth.getFullYear();
    const mm        = String(prevMonth.getMonth() + 1).padStart(2, "0");
    const yearMonth = `${yyyy}-${mm}`;

    const unbilledGroups = await prisma.billingEvent.groupBy({
      by:    ["barbershopId"],
      where: { yearMonth, invoicedAt: null },
      _sum:  { amountCents: true },
      _count: { _all: true },
    });

    const errors: string[] = [];
    let invoiced = 0;

    for (const group of unbilledGroups) {
      const { barbershopId } = group;
      const totalCents = group._sum.amountCents ?? 0;
      const count      = group._count._all;
      if (totalCents === 0) continue;

      try {
        const barbershop = await prisma.barbershop.findUnique({
          where:  { id: barbershopId },
          select: { stripeCustomerId: true, name: true, subscription: { select: { stripeSubId: true, planTier: true } } },
        });

        if (!barbershop?.stripeCustomerId || barbershop.subscription?.planTier !== "PRO") continue;

        await stripe.invoiceItems.create({
          customer:    barbershop.stripeCustomerId,
          amount:      totalCents,
          currency:    "brl",
          description: `${count} atendimento${count !== 1 ? "s" : ""} concluído${count !== 1 ? "s" : ""} em ${mm}/${yyyy} — ${barbershop.name}`,
          ...(barbershop.subscription?.stripeSubId ? { subscription: barbershop.subscription.stripeSubId } : {}),
        });

        await prisma.billingEvent.updateMany({
          where: { barbershopId, yearMonth, invoicedAt: null },
          data:  { invoicedAt: now },
        });

        invoiced++;
      } catch (err) {
        console.error(`[cron/billing] failed for ${barbershopId}:`, err);
        errors.push(barbershopId);
      }
    }

    billingResult = { invoiced, errors };
  }

  return NextResponse.json({
    date:    new Date().toISOString(),
    results,
    total:   results.length,
    billing: billingResult,
  });
}
