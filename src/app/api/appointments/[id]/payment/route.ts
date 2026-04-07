import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PaymentStatus } from "@prisma/client";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { paidValue, discountValue, note, paymentMethod, cardBrand, cardPaymentType, cardInstallments } = await req.json();
  const appointment = await prisma.appointment.findFirst({
    where: { OR: [{ id }, { trinksId: id }], barbershopId: session.user.barbershopId },
  });
  if (!appointment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: any = {
    barbershopId: session.user.barbershopId,
    appointmentId: appointment.id,
    domain: "BARBERSHOP_SERVICE" as const,
    status: paidValue ? PaymentStatus.PAID : PaymentStatus.PENDING,
    amount: paidValue ?? 0,
    paidValue: paidValue ?? null,
    discountValue: discountValue ?? null,
    description: note ?? null,
    paymentMethod: paymentMethod ?? null,
    paidAt: paidValue ? new Date() : null,
  };

  // Card fee tracking
  if (paymentMethod === "CARD" && cardBrand && cardPaymentType) {
    data.cardBrand = cardBrand;
    data.cardPaymentType = cardPaymentType;
    data.cardInstallments = cardInstallments ?? 1;

    const feeConfig = await prisma.cardFeeConfig.findUnique({
      where: {
        barbershopId_brand_paymentType: {
          barbershopId: session.user.barbershopId,
          brand: cardBrand,
          paymentType: cardPaymentType,
        },
      },
    });
    if (feeConfig) {
      const paidVal = Number(paidValue ?? 0);
      const feePercent = Number(feeConfig.feePercent);
      data.machineFeePercent = feePercent;
      data.machineFeeValue = Math.round(paidVal * feePercent) / 100;
    }
  } else {
    // Clear card details if not card payment
    data.cardBrand = null;
    data.cardPaymentType = null;
    data.cardInstallments = null;
    data.machineFeePercent = null;
    data.machineFeeValue = null;
  }

  const existing = await prisma.payment.findFirst({ where: { appointmentId: appointment.id, domain: "BARBERSHOP_SERVICE" } });
  const payment = existing
    ? await prisma.payment.update({ where: { id: existing.id }, data })
    : await prisma.payment.create({ data });

  return NextResponse.json({ payment });
}
