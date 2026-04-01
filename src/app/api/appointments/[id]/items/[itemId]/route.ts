import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, quantity, unitPrice } = await req.json();
  const item = await prisma.appointmentItem.findUnique({
    where: { id: params.itemId },
    include: { appointment: true },
  });
  if (!item || item.appointment.barbershopId !== session.user.barbershopId || item.appointmentId !== params.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const totalPrice = Number(unitPrice ?? item.unitPrice) * Number(quantity ?? item.quantity);

  const updated = await prisma.appointmentItem.update({
    where: { id: params.itemId },
    data: {
      name: name ?? item.name,
      quantity: quantity !== undefined ? Number(quantity) : item.quantity,
      unitPrice: unitPrice !== undefined ? Number(unitPrice) : item.unitPrice,
      totalPrice,
    },
  });
  return NextResponse.json({ item: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const item = await prisma.appointmentItem.findUnique({
    where: { id: params.itemId },
    include: { appointment: true },
  });
  if (!item || item.appointment.barbershopId !== session.user.barbershopId || item.appointmentId !== params.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.appointmentItem.delete({ where: { id: params.itemId } });
  return NextResponse.json({ ok: true });
}
