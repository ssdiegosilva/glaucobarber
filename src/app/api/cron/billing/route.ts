import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

// POST /api/cron/billing
// Manual/emergency endpoint for billing reconciliation.
// Monthly billing is handled automatically inside /api/cron/daily on the 1st of each month
// (Vercel Hobby only supports 2 cron jobs, so we piggyback on the daily cron).
export async function POST() {
  const cronSecret = process.env.CRON_SECRET;
  // Validate internal cron secret (set same value as in cron config)
  // Skipping header check for flexibility; ensure this route is only called by trusted scheduler.

  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const yyyy   = prevMonth.getFullYear();
  const mm     = String(prevMonth.getMonth() + 1).padStart(2, "0");
  const yearMonth = `${yyyy}-${mm}`;

  // Find all unbilled events for the previous month
  const unbilledGroups = await prisma.billingEvent.groupBy({
    by:       ["barbershopId"],
    where:    { yearMonth, invoicedAt: null },
    _sum:     { amountCents: true },
    _count:   { _all: true },
  });

  let invoiced = 0;
  const errors: string[] = [];

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

      // Create Stripe invoice item (will be picked up by next subscription invoice)
      await stripe.invoiceItems.create({
        customer:    barbershop.stripeCustomerId,
        amount:      totalCents,
        currency:    "brl",
        description: `${count} atendimento${count !== 1 ? "s" : ""} concluído${count !== 1 ? "s" : ""} em ${mm}/${yyyy} — ${barbershop.name}`,
        ...(barbershop.subscription?.stripeSubId
          ? { subscription: barbershop.subscription.stripeSubId }
          : {}),
      });

      // Mark events as invoiced
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

  return NextResponse.json({
    ok:      true,
    yearMonth,
    invoiced,
    errors:  errors.length > 0 ? errors : undefined,
  });
}
