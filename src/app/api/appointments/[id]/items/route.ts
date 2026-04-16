import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { name, quantity = 1, unitPrice, serviceId, productId } = await req.json();
  if (!name || unitPrice === undefined) return NextResponse.json({ error: "Nome e preço são obrigatórios" }, { status: 400 });

  const appointment = await prisma.appointment.findFirst({
    where: { OR: [{ id }, { trinksId: id }], barbershopId: session.user.barbershopId },
  });
  if (!appointment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const totalPrice = Number(unitPrice) * Number(quantity ?? 1);

  const item = await prisma.appointmentItem.create({
    data: {
      appointmentId: appointment.id,
      serviceId: serviceId ?? null,
      productId: productId ?? null,
      name,
      quantity: Number(quantity ?? 1),
      unitPrice: Number(unitPrice),
      totalPrice,
    },
  });

  return NextResponse.json({ item });
}
