import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { AI_CREDITS_PACK } from "@/lib/credits-config";
import type Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body      = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    return NextResponse.json({ error: `Webhook error: ${err}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(s);
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(sub);
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(inv);
        break;
      }
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const barbershopId = session.metadata?.barbershopId;
  if (!barbershopId) return;

  // Handle AI credit pack purchase (one-time payment)
  if (session.metadata?.creditType === "ai_pack") {
    await prisma.platformSubscription.upsert({
      where:  { barbershopId },
      create: {
        barbershopId,
        planTier:              "FREE",
        status:                "ACTIVE",
        aiCreditBalance:       AI_CREDITS_PACK.credits,
        aiCreditsPurchased:    AI_CREDITS_PACK.credits,
        currentPeriodStart:    new Date(),
        currentPeriodEnd:      new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
      update: {
        aiCreditBalance:    { increment: AI_CREDITS_PACK.credits },
        aiCreditsPurchased: { increment: AI_CREDITS_PACK.credits },
      },
    });
    if (session.customer) {
      await prisma.barbershop.update({
        where: { id: barbershopId },
        data:  { stripeCustomerId: session.customer as string },
      });
    }
    return;
  }

  // Save stripeCustomerId on barbershop
  if (session.customer) {
    await prisma.barbershop.update({
      where: { id: barbershopId },
      data:  { stripeCustomerId: session.customer as string },
    });
  }

  // Load subscription details
  if (!session.subscription) return;

  const sub = await stripe.subscriptions.retrieve(session.subscription as string);
  await upsertSubscription(sub, barbershopId);
}

async function handleSubscriptionChange(sub: Stripe.Subscription) {
  const barbershopId = sub.metadata?.barbershopId;
  if (!barbershopId) return;
  await upsertSubscription(sub, barbershopId);
}

async function handlePaymentFailed(inv: Stripe.Invoice) {
  // Update subscription status
  if (!inv.subscription) return;
  const sub = await stripe.subscriptions.retrieve(inv.subscription as string);
  const barbershopId = sub.metadata?.barbershopId;
  if (barbershopId) {
    await upsertSubscription(sub, barbershopId);
  }
}

/** Stripe ≥2024-xx returns ISO strings; older versions return Unix timestamps */
function stripeDate(value: unknown, fallback?: Date): Date {
  let d: Date;
  if (value == null)              d = new Date(NaN);
  else if (typeof value === "number") d = new Date(value * 1000);
  else                            d = new Date(value as string);
  return isNaN(d.getTime()) ? (fallback ?? new Date()) : d;
}

function stripeDateOrNull(value: unknown): Date | null {
  if (value == null) return null;
  const d = stripeDate(value);
  return isNaN(d.getTime()) ? null : d;
}

async function upsertSubscription(sub: Stripe.Subscription, barbershopId: string) {
  // Ensure stripeCustomerId is saved on Barbershop (may be missing if checkout webhook was missed)
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (customerId) {
    await prisma.barbershop.updateMany({
      where: { id: barbershopId, stripeCustomerId: null },
      data:  { stripeCustomerId: customerId },
    });
  }

  const priceId = sub.items.data[0]?.price.id ?? "";

  // Map Stripe price to plan tier — read from DB first, fallback to env vars
  const dbConfigs = await prisma.platformConfig.findMany({
    where: { key: { in: ["stripe_price_pro_monthly", "stripe_price_enterprise_monthly"] } },
  });
  const get = (k: string) => dbConfigs.find((c) => c.key === k)?.value || process.env[k.toUpperCase()] || "";

  const PRICE_PLAN_MAP: Record<string, "PRO" | "ENTERPRISE"> = {
    [get("stripe_price_pro_monthly")]:        "PRO",
    [get("stripe_price_enterprise_monthly")]: "ENTERPRISE",
  };

  const planTier = PRICE_PLAN_MAP[priceId] ?? "PRO";

  const STATUS_MAP: Record<string, "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "UNPAID" | "INCOMPLETE"> = {
    trialing:          "TRIALING",
    active:            "ACTIVE",
    past_due:          "PAST_DUE",
    canceled:          "CANCELED",
    unpaid:            "UNPAID",
    incomplete:        "INCOMPLETE",
    incomplete_expired: "INCOMPLETE",
  };

  await prisma.platformSubscription.upsert({
    where:  { barbershopId },
    create: {
      barbershopId,
      stripeSubId:  sub.id,
      stripePriceId: priceId,
      planTier,
      status:               STATUS_MAP[sub.status] ?? "ACTIVE",
      currentPeriodStart:   stripeDate(sub.current_period_start),
      currentPeriodEnd:     stripeDate(sub.current_period_end, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
      cancelAtPeriodEnd:    sub.cancel_at_period_end,
      trialEndsAt:          stripeDateOrNull(sub.trial_end),
    },
    update: {
      stripeSubId:  sub.id,
      stripePriceId: priceId,
      planTier,
      status:               STATUS_MAP[sub.status] ?? "ACTIVE",
      currentPeriodStart:   stripeDate(sub.current_period_start),
      currentPeriodEnd:     stripeDate(sub.current_period_end, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
      cancelAtPeriodEnd:    sub.cancel_at_period_end,
      trialEndsAt:          stripeDateOrNull(sub.trial_end),
    },
  });
}
