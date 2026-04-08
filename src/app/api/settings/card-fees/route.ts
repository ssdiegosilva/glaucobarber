import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CARD_BRANDS, PAYMENT_TYPES } from "@/lib/card-fees";

export async function GET() {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const configs = await prisma.cardFeeConfig.findMany({
    where: { barbershopId: session.user.barbershopId },
    orderBy: [{ brand: "asc" }, { paymentType: "asc" }],
    select: { brand: true, paymentType: true, feePercent: true },
  });

  return NextResponse.json({
    configs: configs.map((c) => ({
      brand: c.brand,
      paymentType: c.paymentType,
      feePercent: Number(c.feePercent),
    })),
  });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { configs } = (await req.json()) as {
    configs: { brand: string; paymentType: string; feePercent: number }[];
  };

  if (!Array.isArray(configs)) {
    return NextResponse.json({ error: "configs must be an array" }, { status: 400 });
  }

  // Validate
  const validBrands = new Set<string>(CARD_BRANDS);
  const validTypes = new Set<string>(PAYMENT_TYPES);
  for (const c of configs) {
    if (!validBrands.has(c.brand)) {
      return NextResponse.json({ error: `Bandeira invalida: ${c.brand}` }, { status: 400 });
    }
    if (!validTypes.has(c.paymentType)) {
      return NextResponse.json({ error: `Tipo invalido: ${c.paymentType}` }, { status: 400 });
    }
    if (typeof c.feePercent !== "number" || c.feePercent < 0 || c.feePercent > 99.99) {
      return NextResponse.json({ error: `Taxa invalida: ${c.feePercent}` }, { status: 400 });
    }
  }

  const barbershopId = session.user.barbershopId;

  await prisma.$transaction([
    prisma.cardFeeConfig.deleteMany({ where: { barbershopId } }),
    ...configs.map((c) =>
      prisma.cardFeeConfig.create({
        data: {
          barbershopId,
          brand: c.brand,
          paymentType: c.paymentType,
          feePercent: c.feePercent,
        },
      })
    ),
  ]);

  return NextResponse.json({ ok: true });
}
