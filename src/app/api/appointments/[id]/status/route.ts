import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppointmentStatus } from "@prisma/client";
import { buildTrinksClient } from "@/lib/integrations/trinks/client";
import { refreshPostSaleStatus } from "@/modules/post-sale/service";

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

  return NextResponse.json({ ok: true });
}
