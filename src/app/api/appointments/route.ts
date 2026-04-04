import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyAppointmentEvent } from "@/lib/appointment-notifications";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const barbershopId = session.user.barbershopId;

  const body = await req.json();
  const { customerId, serviceId, scheduledAt, durationMin, price, barberId, notes } = body;

  if (!customerId || !scheduledAt) {
    return NextResponse.json({ error: "customerId e scheduledAt são obrigatórios" }, { status: 400 });
  }

  const newDate = new Date(scheduledAt);
  if (isNaN(newDate.getTime())) {
    return NextResponse.json({ error: "Data inválida" }, { status: 400 });
  }

  // Verify customer belongs to this barbershop
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, barbershopId },
    select: { id: true, name: true },
  });
  if (!customer) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  // Fetch service info if provided
  let resolvedService: { name: string; durationMin: number | null; price: number | null } | null = null;
  if (serviceId) {
    const svc = await prisma.service.findFirst({
      where: { id: serviceId, barbershopId },
      select: { name: true, durationMin: true, price: true },
    });
    if (svc) resolvedService = { name: svc.name, durationMin: svc.durationMin, price: svc.price ? Number(svc.price) : null };
  }

  const appointment = await prisma.appointment.create({
    data: {
      barbershopId,
      customerId,
      serviceId:   serviceId ?? null,
      scheduledAt: newDate,
      status:      "SCHEDULED",
      durationMin: durationMin ?? resolvedService?.durationMin ?? 30,
      price:       price != null ? price : resolvedService?.price ?? null,
      barberId:    barberId ?? null,
      notes:       notes ?? null,
    },
    select: {
      id:          true,
      scheduledAt: true,
      status:      true,
      durationMin: true,
      price:       true,
      customer:    { select: { name: true } },
      service:     { select: { name: true } },
    },
  });

  // Update customer nextAppointmentAt if this is nearer than existing
  if (newDate > new Date()) {
    const existing = await prisma.customer.findUnique({
      where:  { id: customerId },
      select: { nextAppointmentAt: true },
    });
    if (!existing?.nextAppointmentAt || newDate < existing.nextAppointmentAt) {
      await prisma.customer.update({
        where: { id: customerId },
        data:  { nextAppointmentAt: newDate },
      });
    }
  }

  // Notifica cliente via WhatsApp (fire-and-forget)
  notifyAppointmentEvent({
    barbershopId,
    customerId,
    scheduledAt: newDate,
    serviceName: resolvedService?.name ?? null,
    event: "CREATED",
  }).catch(() => null);

  return NextResponse.json({ ok: true, appointment }, { status: 201 });
}
