import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, itemId } = await params;
  const { name, quantity, unitPrice } = await req.json();
  const item = await prisma.appointmentItem.findUnique({
    where: { id: itemId },
    include: { appointment: true },
  });
  if (!item || item.appointment.barbershopId !== session.user.barbershopId || item.appointmentId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const totalPrice = Number(unitPrice ?? item.unitPrice) * Number(quantity ?? item.quantity);

  const updated = await prisma.appointmentItem.update({
    where: { id: itemId },
    data: {
      name: name ?? item.name,
      quantity: quantity !== undefined ? Number(quantity) : item.quantity,
      unitPrice: unitPrice !== undefined ? Number(unitPrice) : item.unitPrice,
      totalPrice,
    },
  });
  return NextResponse.json({ item: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, itemId } = await params;
  const item = await prisma.appointmentItem.findUnique({
    where: { id: itemId },
    include: { appointment: true },
  });
  if (!item || item.appointment.barbershopId !== session.user.barbershopId || item.appointmentId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.appointmentItem.delete({ where: { id: itemId } });
  return NextResponse.json({ ok: true });
}
