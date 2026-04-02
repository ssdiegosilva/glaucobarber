import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.barbershopId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const offers = await prisma.offer.findMany({
    where:   { barbershopId: session.user.barbershopId },
    include: {
      items: {
        include: { service: { select: { id: true, name: true, category: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    offers: offers.map((o) => ({
      ...o,
      originalPrice: Number(o.originalPrice),
      salePrice:     Number(o.salePrice),
      items: o.items.map((i) => ({
        ...i,
        unitPrice: Number(i.unitPrice),
      })),
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const barbershopId = session.user.barbershopId;

  const body = await req.json();
  const { title, description, type, items, validUntil, maxRedemptions } = body as {
    title:           string;
    description?:    string;
    type:            string;
    items:           { serviceId: string; discountPct: number }[];
    validUntil?:     string;
    maxRedemptions?: number;
  };

  if (!title?.trim()) return NextResponse.json({ error: "Título obrigatório" }, { status: 400 });
  if (!items?.length) return NextResponse.json({ error: "Selecione ao menos um serviço" }, { status: 400 });

  // Fetch service prices
  const serviceIds = items.map((i) => i.serviceId);
  const services   = await prisma.service.findMany({
    where:  { id: { in: serviceIds }, barbershopId },
    select: { id: true, price: true },
  });
  const priceMap = new Map(services.map((s) => [s.id, Number(s.price)]));

  let originalTotal = 0;
  let saleTotal     = 0;
  const offerItems  = items.map((item) => {
    const unitPrice   = priceMap.get(item.serviceId) ?? 0;
    const discounted  = unitPrice * (1 - item.discountPct / 100);
    originalTotal    += unitPrice;
    saleTotal        += discounted;
    return {
      serviceId:  item.serviceId,
      quantity:   1,
      unitPrice,
      discountPct: item.discountPct,
    };
  });

  const offer = await prisma.offer.create({
    data: {
      barbershopId,
      type:          type as never,
      title:         title.trim(),
      description:   description?.trim() ?? null,
      originalPrice: originalTotal,
      salePrice:     saleTotal,
      validUntil:    validUntil ? new Date(validUntil) : null,
      maxRedemptions: maxRedemptions ?? null,
      items: { create: offerItems },
    },
    include: {
      items: { include: { service: { select: { id: true, name: true, category: true } } } },
    },
  });

  return NextResponse.json({
    offer: {
      ...offer,
      originalPrice: Number(offer.originalPrice),
      salePrice:     Number(offer.salePrice),
      items: offer.items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice) })),
    },
  });
}
