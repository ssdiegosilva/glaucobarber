import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildTrinksClient } from "@/lib/integrations/trinks/client";
import { format } from "date-fns";
import { notifyAppointmentEvent } from "@/lib/appointment-notifications";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { scheduledAt } = await req.json();

  if (!scheduledAt) return NextResponse.json({ error: "scheduledAt obrigatório" }, { status: 400 });

  const newDate = new Date(scheduledAt);
  if (isNaN(newDate.getTime())) return NextResponse.json({ error: "Data inválida" }, { status: 400 });

  const [appointment, integration] = await Promise.all([
    prisma.appointment.findFirst({
      where: { OR: [{ id }, { trinksId: id }], barbershopId: session.user.barbershopId },
    }),
    prisma.integration.findUnique({
      where:  { barbershopId: session.user.barbershopId },
      select: { provider: true, status: true, configJson: true },
    }),
  ]);
  if (!appointment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Block write on Avec-sourced appointments while Avec integration is active
  if (appointment.avecId && integration?.provider === "avec" && integration?.status === "ACTIVE") {
    return NextResponse.json(
      { error: "Agendamento gerenciado pela Avec — acesse o painel Avec para alterações" },
      { status: 403 }
    );
  }

  await prisma.appointment.update({
    where: { id: appointment.id },
    data:  { scheduledAt: newDate, status: "SCHEDULED", confirmedAt: null, completedAt: null, noShowAt: null },
  });

  // Update customer nextAppointmentAt if this is the nearest future appointment
  if (appointment.customerId && newDate > new Date()) {
    const existing = await prisma.customer.findUnique({
      where:  { id: appointment.customerId },
      select: { nextAppointmentAt: true },
    });
    if (!existing?.nextAppointmentAt || newDate < existing.nextAppointmentAt) {
      await prisma.customer.update({
        where: { id: appointment.customerId },
        data:  { nextAppointmentAt: newDate },
      });
    }
  }

  // Mirror to Trinks (best-effort)
  if (appointment.trinksId && integration?.configJson && integration.provider === "trinks") {
    try {
      const client         = buildTrinksClient(integration.configJson);
      const trinksDatetime = format(newDate, "yyyy-MM-dd'T'HH:mm:ss");
      await client.rescheduleAppointment(appointment.trinksId, trinksDatetime);
    } catch (err) {
      console.error("[reschedule] failed to sync to Trinks:", err);
    }
  }

  // Notifica cliente via WhatsApp (fire-and-forget)
  if (appointment.customerId) {
    const apptService = await prisma.appointment.findUnique({
      where: { id: appointment.id },
      select: { service: { select: { name: true } } },
    });
    notifyAppointmentEvent({
      barbershopId: session.user.barbershopId,
      customerId: appointment.customerId,
      scheduledAt: newDate,
      serviceName: apptService?.service?.name ?? null,
      event: "RESCHEDULED",
    }).catch(() => null);
  }

  return NextResponse.json({ ok: true, scheduledAt: newDate.toISOString() });
}
