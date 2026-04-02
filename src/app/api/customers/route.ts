import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, phone, email, notes } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  const customer = await prisma.customer.create({
    data: {
      barbershopId: session.user.barbershopId,
      name:         name.trim(),
      phone:        phone?.trim() ?? null,
      email:        email?.trim() ?? null,
      notes:        notes?.trim() ?? null,
      syncedFromTrinks: false,
    },
    select: { id: true, name: true, phone: true, email: true, notes: true, doNotContact: true, tags: true, totalVisits: true, status: true, postSaleStatus: true, createdAt: true },
  });

  return NextResponse.json({ customer }, { status: 201 });
}
