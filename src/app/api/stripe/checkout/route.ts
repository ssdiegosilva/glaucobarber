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

  try {
    const checkout = await createCheckoutSession({
      barbershopId:     barbershop!.id,
      stripeCustomerId: barbershop?.stripeCustomerId ?? null,
      priceId,
      successUrl:       `${baseUrl}/billing?success=1`,
      cancelUrl:        `${baseUrl}/billing?canceled=1`,
    });

    return NextResponse.json({ url: checkout.url });
  } catch (err) {
    if (err instanceof Stripe.errors.StripeInvalidRequestError) {
      console.error("[stripe/checkout] Stripe error:", err.message);
      return NextResponse.json(
        { error: `Erro Stripe: ${err.message}` },
        { status: 400 },
      );
    }
    console.error("[stripe/checkout] Unexpected error:", err);
    return NextResponse.json(
      { error: "Erro ao iniciar checkout. Tente novamente." },
      { status: 500 },
    );
  }
}
