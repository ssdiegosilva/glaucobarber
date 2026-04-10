import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const services = await prisma.service.findMany({
    where:   { barbershopId: session.user.barbershopId, active: true, deletedAt: null },
    select:  { id: true, name: true, price: true, durationMin: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ services: services.map((s) => ({ ...s, price: Number(s.price) })) });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, category, price, durationMin, description } = body;

  if (!name?.trim()) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
  if (price == null || isNaN(Number(price))) return NextResponse.json({ error: "Preço inválido" }, { status: 400 });

  const VALID_CATEGORIES = ["HAIRCUT", "BEARD", "COMBO", "TREATMENT", "OTHER"];
  const cat = VALID_CATEGORIES.includes(category) ? category : "HAIRCUT";

  const service = await prisma.service.create({
    data: {
      barbershopId:    session.user.barbershopId,
      name:            name.trim(),
      category:        cat,
      price:           Number(price),
      durationMin:     durationMin ? Number(durationMin) : 30,
      description:     description?.trim() || null,
      syncedFromTrinks: false,
    },
  });

  return NextResponse.json({ service: { ...service, price: Number(service.price) } }, { status: 201 });
}
