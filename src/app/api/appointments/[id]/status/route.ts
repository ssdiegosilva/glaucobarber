import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppointmentStatus } from "@prisma/client";
import { buildTrinksClient } from "@/lib/integrations/trinks/client";
import { refreshPostSaleStatus, refreshCustomer60dStats } from "@/modules/post-sale/service";
import { createAppointmentBillingEvent } from "@/lib/billing";
import { notifyAppointmentEvent } from "@/lib/appointment-notifications";

const allowed: AppointmentStatus[] = ["SCHEDULED", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"];

const TRINKS_STATUS_MAP: Partial<Record<AppointmentStatus, "confirmado" | "cancelado" | "finalizado" | "clientefaltou" | "ematendimento">> = {
  CONFIRMED:   "confirmado",
  IN_PROGRESS: "ematendimento",
  COMPLETED:   "finalizado",
  CANCELLED:   "cancelado",
  NO_SHOW:     "clientefaltou",
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { status } = await req.json();
  if (!allowed.includes(status)) return NextResponse.json({ error: "Status inválido" }, { status: 400 });

  const appointment = await prisma.appointment.findFirst({
    where: { OR: [{ id }, { trinksId: id }], barbershopId: session.user.barbershopId },
  });
  if (!appointment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: any = { status };
  const now = new Date();
  if (status === "CONFIRMED")   data.confirmedAt = now;
  if (status === "COMPLETED")   data.completedAt = now;
  if (status === "NO_SHOW")     data.noShowAt    = now;

  await prisma.appointment.update({ where: { id: appointment.id }, data });

  // Atualiza campos de pós-venda no cliente imediatamente (sem esperar o sync)
  if (appointment.customerId) {
    if (status === "COMPLETED") {
      // Busca serviço do agendamento para preencher lastServiceSummary
      const apptWithService = await prisma.appointment.findUnique({
        where:   { id: appointment.id },
        include: { service: { select: { name: true } }, items: { select: { name: true } } },
      });
      const serviceName = apptWithService?.service?.name
        ?? apptWithService?.items.map((i) => i.name).join(", ")
        ?? null;

      await prisma.customer.update({
        where: { id: appointment.customerId },
        data: {
          lastCompletedAppointmentAt: now,
          lastServiceSummary: serviceName,
          lastSpentAmount:    appointment.price,
        },
      });

      // Atualiza rolling 60d (fire-and-forget)
      refreshCustomer60dStats(appointment.customerId).catch(() => null);
    }
    if (status === "SCHEDULED" || status === "CONFIRMED") {
      // Garante que nextAppointmentAt reflete este agendamento se for o mais próximo
      const existing = await prisma.customer.findUnique({
        where:  { id: appointment.customerId },
        select: { nextAppointmentAt: true },
      });
      if (!existing?.nextAppointmentAt || appointment.scheduledAt < existing.nextAppointmentAt) {
        await prisma.customer.update({
          where: { id: appointment.customerId },
          data:  { nextAppointmentAt: appointment.scheduledAt },
        });
      }
    }
    if (status === "CANCELLED" || status === "NO_SHOW") {
      // Remove nextAppointmentAt se era este agendamento
      const existing = await prisma.customer.findUnique({
        where:  { id: appointment.customerId },
        select: { nextAppointmentAt: true },
      });
      if (existing?.nextAppointmentAt?.getTime() === appointment.scheduledAt.getTime()) {
        await prisma.customer.update({
          where: { id: appointment.customerId },
          data:  { nextAppointmentAt: null },
        });
      }
    }
  }

  // Mirror status to Trinks (best-effort, don't fail if Trinks is down)
  const trinksStatus = TRINKS_STATUS_MAP[status as AppointmentStatus];
  if (trinksStatus && appointment.trinksId) {
    try {
      const integration = await prisma.integration.findUnique({ where: { barbershopId: session.user.barbershopId } });
      if (integration?.configJson) {
        const client = buildTrinksClient(integration.configJson);
        await client.updateAppointmentStatus(appointment.trinksId, trinksStatus);
      }
    } catch (err) {
      console.error("[status] failed to sync to Trinks:", err);
    }
  }

  // Refresh post-sale status for this customer when appointment is completed
  if (status === "COMPLETED" && appointment.customerId) {
    refreshPostSaleStatus(session.user.barbershopId).catch(() => null);
  }

  // PRO plan: register per-appointment billing event (fire-and-forget)
  if (status === "COMPLETED") {
    createAppointmentBillingEvent(session.user.barbershopId, appointment.id).catch(() => null);
  }

  // Notifica cliente via WhatsApp (fire-and-forget)
  if (appointment.customerId) {
    const apptForNotify = await prisma.appointment.findUnique({
      where: { id: appointment.id },
      select: { scheduledAt: true, service: { select: { name: true } } },
    });
    notifyAppointmentEvent({
      barbershopId: session.user.barbershopId,
      customerId: appointment.customerId,
      scheduledAt: apptForNotify?.scheduledAt ?? appointment.scheduledAt,
      serviceName: apptForNotify?.service?.name ?? null,
      event: status as "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW",
    }).catch(() => null);
  }

  return NextResponse.json({ ok: true });
}
