import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { name, slug } = await req.json();

  if (!name?.trim() || !slug?.trim()) {
    return NextResponse.json({ error: "Nome e slug são obrigatórios" }, { status: 400 });
  }

  // Check slug uniqueness
  const existing = await prisma.barbershop.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "Essa URL já está em uso. Escolha outra." }, { status: 409 });
  }

  // Create barbershop + membership in a transaction
  const barbershop = await prisma.$transaction(async (tx) => {
    const shop = await tx.barbershop.create({
      data: {
        name: name.trim(),
        slug,
        trinksConfigured: false,
      },
    });

    await tx.membership.create({
      data: {
        userId:       session.user.id,
        barbershopId: shop.id,
        role:         "OWNER",
        active:       true,
      },
    });

    // Auto-create FREE plan subscription (no Stripe required)
    const now = new Date();
    await tx.platformSubscription.create({
      data: {
        barbershopId:      shop.id,
        planTier:          "FREE",
        status:            "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd:   new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
      },
    });

    return shop;
  });

  return NextResponse.json({ barbershopId: barbershop.id });
}
