import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, quantity = 1, unitPrice, serviceId } = await req.json();
  if (!name || unitPrice === undefined) return NextResponse.json({ error: "Nome e preço são obrigatórios" }, { status: 400 });

  const appointment = await prisma.appointment.findUnique({ where: { id: params.id } });
  if (!appointment || appointment.barbershopId !== session.user.barbershopId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const totalPrice = Number(unitPrice) * Number(quantity ?? 1);

  const item = await prisma.appointmentItem.create({
    data: {
      appointmentId: params.id,
      serviceId,
      name,
      quantity: Number(quantity ?? 1),
      unitPrice: Number(unitPrice),
      totalPrice,
    },
  });

  return NextResponse.json({ item });
}
