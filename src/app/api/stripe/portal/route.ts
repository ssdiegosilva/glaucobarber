import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPortalSession } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const barbershop = await prisma.barbershop.findUnique({
    where:  { id: session.user.barbershopId },
    select: { stripeCustomerId: true },
  });

  if (!barbershop?.stripeCustomerId) {
    return NextResponse.json({ error: "Sem assinatura Stripe" }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://glaucobarber.com";
  const portal  = await createPortalSession({
    stripeCustomerId: barbershop.stripeCustomerId,
    returnUrl: `${baseUrl}/billing`,
  });

  return NextResponse.json({ url: portal.url });
}
