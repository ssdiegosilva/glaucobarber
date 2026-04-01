import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppointmentStatus } from "@prisma/client";

const allowed: AppointmentStatus[] = ["SCHEDULED", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"];

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
  if (status === "CONFIRMED") data.confirmedAt = now;
  if (status === "COMPLETED") data.completedAt = now;
  if (status === "NO_SHOW") data.noShowAt = now;

  await prisma.appointment.update({ where: { id: appointment.id }, data });
  return NextResponse.json({ ok: true });
}
