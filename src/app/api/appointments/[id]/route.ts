import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function calcTotals(items: { totalPrice: any }[], appointmentPrice?: any, discountValue?: any, paidValue?: any) {
  const subtotal = items.reduce((acc, it) => acc + Number(it.totalPrice), 0) || Number(appointmentPrice ?? 0);
  const discount = Number(discountValue ?? 0);
  const total = Math.max(subtotal - discount, 0);
  const paid = Number(paidValue ?? 0);
  const remaining = Math.max(total - paid, 0);
  return { subtotal, discount, total, paid, remaining };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      items: true,
      payments: { where: { domain: "BARBERSHOP_SERVICE" }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!appointment || appointment.barbershopId !== session.user.barbershopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const payment = appointment.payments[0] ?? null;
  const totals = calcTotals(appointment.items, appointment.price, payment?.discountValue, payment?.paidValue ?? payment?.amount);

  return NextResponse.json({ appointment, payment, totals });
}
