import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPortalSession } from "@/lib/stripe";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const barbershopId = session.user.barbershopId;

  const barbershop = await prisma.barbershop.findUnique({
    where:  { id: barbershopId },
    select: { stripeCustomerId: true },
  });

  if (!barbershop?.stripeCustomerId) {
    return NextResponse.json({ error: "Sem assinatura Stripe" }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://voltaki.com";

  try {
    const portal = await createPortalSession({
      stripeCustomerId: barbershop.stripeCustomerId,
      returnUrl: `${baseUrl}/billing`,
    });
    return NextResponse.json({ url: portal.url });
  } catch (err) {
    if (
      err instanceof Stripe.errors.StripeInvalidRequestError &&
      err.code === "resource_missing"
    ) {
      // Customer was deleted in Stripe — clear stale ID from DB
      await prisma.barbershop.update({
        where: { id: barbershopId },
        data:  { stripeCustomerId: null },
      });
      await prisma.platformSubscription.updateMany({
        where: { barbershopId },
        data:  { stripeSubId: null, stripePriceId: null, planTier: "FREE", status: "ACTIVE" },
      });
      return NextResponse.json({ error: "Assinatura não encontrada no Stripe. Dados limpos — inicie uma nova assinatura." }, { status: 400 });
    }
    console.error("[stripe/portal] Unexpected error:", err);
    return NextResponse.json({ error: "Erro ao abrir portal. Tente novamente." }, { status: 500 });
  }
}
