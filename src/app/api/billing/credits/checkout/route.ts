import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://voltaki.com";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const barbershopId = session.user.barbershopId;

  const CREDITS_PRICE_ID = process.env.STRIPE_PRICE_AI_CREDITS_PACK ?? "";

  if (!CREDITS_PRICE_ID) {
    return NextResponse.json({ error: "AI credits price not configured" }, { status: 500 });
  }

  const barbershop = await prisma.barbershop.findUnique({
    where:  { id: barbershopId },
    select: { stripeCustomerId: true },
  });

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode:                  "payment",
    line_items:            [{ price: CREDITS_PRICE_ID, quantity: 1 }],
    allow_promotion_codes: true,
    success_url:           `${BASE_URL}/billing?credits=added`,
    cancel_url:            `${BASE_URL}/billing`,
    metadata:              { barbershopId, creditType: "ai_pack" },
  };

  let stripeCustomerId = barbershop?.stripeCustomerId ?? null;

  if (stripeCustomerId) {
    sessionParams.customer = stripeCustomerId;
  }

  const attemptCheckout = () => stripe.checkout.sessions.create(sessionParams);

  try {
    const checkout = await attemptCheckout();
    return NextResponse.json({ url: checkout.url });
  } catch (err) {
    if (
      err instanceof Stripe.errors.StripeInvalidRequestError &&
      err.code === "resource_missing" &&
      stripeCustomerId
    ) {
      // Customer deleted in Stripe — clear and retry without it
      await prisma.barbershop.update({ where: { id: barbershopId }, data: { stripeCustomerId: null } });
      delete sessionParams.customer;
      try {
        const checkout = await attemptCheckout();
        return NextResponse.json({ url: checkout.url });
      } catch (retryErr) {
        console.error("[billing/credits/checkout] Retry error:", retryErr);
        return NextResponse.json({ error: "Erro ao iniciar checkout. Tente novamente." }, { status: 500 });
      }
    }
    console.error("[billing/credits/checkout] Error:", err);
    return NextResponse.json({ error: "Erro ao iniciar checkout. Tente novamente." }, { status: 500 });
  }
}
