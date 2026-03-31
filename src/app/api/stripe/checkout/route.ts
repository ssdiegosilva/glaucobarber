import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCheckoutSession } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const form    = await req.formData();
  const priceId = form.get("priceId") as string;

  if (!priceId) {
    return NextResponse.json({ error: "priceId required" }, { status: 400 });
  }

  const barbershop = await prisma.barbershop.findUnique({
    where:  { id: session.user.barbershopId },
    select: { stripeCustomerId: true, id: true },
  });

  const baseUrl    = process.env.NEXT_PUBLIC_APP_URL ?? "https://glaucobarber.com";
  const checkout   = await createCheckoutSession({
    barbershopId:     barbershop!.id,
    stripeCustomerId: barbershop?.stripeCustomerId ?? null,
    priceId,
    successUrl:       `${baseUrl}/settings?success=1`,
    cancelUrl:        `${baseUrl}/settings?canceled=1`,
  });

  return NextResponse.redirect(checkout.url!, 303);
}
