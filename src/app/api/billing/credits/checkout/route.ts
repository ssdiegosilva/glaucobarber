import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import type Stripe from "stripe";

const CREDITS_PRICE_ID = process.env.STRIPE_PRICE_AI_CREDITS_PACK ?? "";
const BASE_URL         = process.env.NEXT_PUBLIC_APP_URL ?? "https://glaucobarber.com";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const barbershopId = session.user.barbershopId;

  if (!CREDITS_PRICE_ID) {
    return NextResponse.json({ error: "AI credits price not configured" }, { status: 500 });
  }

  const barbershop = await prisma.barbershop.findUnique({
    where:  { id: barbershopId },
    select: { stripeCustomerId: true },
  });

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode:        "payment",
    line_items:  [{ price: CREDITS_PRICE_ID, quantity: 1 }],
    success_url: `${BASE_URL}/billing?credits=added`,
    cancel_url:  `${BASE_URL}/billing`,
    metadata:    { barbershopId, creditType: "ai_pack" },
  };

  if (barbershop?.stripeCustomerId) {
    sessionParams.customer = barbershop.stripeCustomerId;
  } else {
    sessionParams.customer_creation = "always";
  }

  const checkout = await stripe.checkout.sessions.create(sessionParams);
  return NextResponse.redirect(checkout.url!, 303);
}
