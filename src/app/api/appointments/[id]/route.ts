import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildTrinksClient } from "@/lib/integrations/trinks/client";
import { mapTrinksAppointment } from "@/lib/integrations/trinks/mappers";

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
  const barbershopId = session.user.barbershopId;

  let appointment = await prisma.appointment.findFirst({
    where: { OR: [{ id }, { trinksId: id }], barbershopId },
    include: {
      items: true,
      payments: { where: { domain: "BARBERSHOP_SERVICE" }, orderBy: { createdAt: "desc" } },
    },
  });

  // If not in DB and id looks like a Trinks numeric ID, do an on-demand upsert
  if (!appointment && /^\d+$/.test(id)) {
    try {
      const integration = await prisma.integration.findUnique({ where: { barbershopId } });
      if (integration?.configJson) {
        const client = buildTrinksClient(integration.configJson);
        const res = await client.getTodayAppointments();
        const raw = res.data.find((a) => String(a.id) === id);
        if (raw) {
          const [customers, services] = await Promise.all([
            prisma.customer.findMany({ where: { barbershopId, trinksId: { not: null } }, select: { id: true, trinksId: true } }),
            prisma.service.findMany({ where: { barbershopId, trinksId: { not: null } }, select: { id: true, trinksId: true } }),
          ]);
          const customerMap = new Map(customers.map((c) => [c.trinksId!, c.id]));
          const serviceMap  = new Map(services.map((s) => [s.trinksId!, s.id]));
          const data = mapTrinksAppointment(raw, barbershopId, customerMap, serviceMap);
          await prisma.appointment.upsert({
            where:  { barbershopId_trinksId: { barbershopId, trinksId: id } },
            create: data,
            update: { status: data.status, price: data.price, durationMin: data.durationMin, notes: data.notes, lastSyncedAt: new Date() },
          });
          appointment = await prisma.appointment.findFirst({
            where: { trinksId: id, barbershopId },
            include: {
              items: true,
              payments: { where: { domain: "BARBERSHOP_SERVICE" }, orderBy: { createdAt: "desc" } },
            },
          });
        }
      }
    } catch (err) {
      console.error("[appointments/[id]] lazy upsert failed:", err);
    }
  }

  if (!appointment) {
    console.error("[appointments/[id]] not found in DB, id:", id, "barbershopId:", barbershopId);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const payment = appointment.payments[0] ?? null;
  const totals = calcTotals(appointment.items, appointment.price, payment?.discountValue, payment?.paidValue ?? payment?.amount);

  return NextResponse.json({ appointment, payment, totals });
}
