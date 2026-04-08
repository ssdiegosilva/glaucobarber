import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCheckoutSession } from "@/lib/stripe";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const form    = await req.formData();
  const priceId = form.get("priceId") as string;

  if (!priceId) {
    return NextResponse.json({ error: "Plano não configurado. Entre em contato com o suporte." }, { status: 400 });
  }

  const barbershop = await prisma.barbershop.findUnique({
    where:  { id: session.user.barbershopId },
    select: { stripeCustomerId: true, id: true },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://glaucobarber.com";

  const barbershopId = barbershop!.id;
  let stripeCustomerId = barbershop?.stripeCustomerId ?? null;

  const attemptCheckout = (customerId: string | null) =>
    createCheckoutSession({
      barbershopId,
      stripeCustomerId: customerId,
      priceId,
      successUrl: `${baseUrl}/billing?success=1`,
      cancelUrl:  `${baseUrl}/billing?canceled=1`,
    });

  try {
    const checkout = await attemptCheckout(stripeCustomerId);
    return NextResponse.json({ url: checkout.url });
  } catch (err) {
    if (
      err instanceof Stripe.errors.StripeInvalidRequestError &&
      err.code === "resource_missing" &&
      stripeCustomerId
    ) {
      // Customer deleted in Stripe — clear and retry without it
      await prisma.barbershop.update({ where: { id: barbershopId }, data: { stripeCustomerId: null } });
      stripeCustomerId = null;
      try {
        const checkout = await attemptCheckout(null);
        return NextResponse.json({ url: checkout.url });
      } catch (retryErr) {
        console.error("[stripe/checkout] Retry error:", retryErr);
        return NextResponse.json({ error: "Erro ao iniciar checkout. Tente novamente." }, { status: 500 });
      }
    }
    if (err instanceof Stripe.errors.StripeInvalidRequestError) {
      console.error("[stripe/checkout] Stripe error:", err.message);
      return NextResponse.json({ error: `Erro Stripe: ${err.message}` }, { status: 400 });
    }
    console.error("[stripe/checkout] Unexpected error:", err);
    return NextResponse.json({ error: "Erro ao iniciar checkout. Tente novamente." }, { status: 500 });
  }
}
