import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const appointment = await prisma.appointment.findFirst({
    where: { OR: [{ id }, { trinksId: id }], barbershopId: session.user.barbershopId },
    select: { customerId: true },
  });

  if (!appointment?.customerId) {
    return NextResponse.json({ customer: null, recentAppointments: [] });
  }

  const [customer, recentAppointments] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: appointment.customerId },
      select: {
        id:                         true,
        name:                       true,
        phone:                      true,
        postSaleStatus:             true,
        lastCompletedAppointmentAt: true,
        lastServiceSummary:         true,
        lastSpentAmount:            true,
        totalSpentLast60d:          true,
        visitsLast60d:              true,
        avgTicketLast60d:           true,
        preferredProfessionalId:    true,
        totalVisits:                true,
        totalSpent:                 true,
        avgTicket:                  true,
      },
    }),

    prisma.appointment.findMany({
      where: {
        customerId:  appointment.customerId,
        status:      "COMPLETED",
      },
      select: {
        id:          true,
        scheduledAt: true,
        price:       true,
        barberId:    true,
        service:     { select: { name: true } },
        items:       { select: { name: true } },
      },
      orderBy: { scheduledAt: "desc" },
      take:    5,
    }),
  ]);

  const recentSerialized = recentAppointments.map((a) => ({
    id:          a.id,
    scheduledAt: a.scheduledAt.toISOString(),
    price:       a.price ? Number(a.price) : null,
    barberId:    a.barberId,
    serviceName: a.service?.name ?? a.items.map((i) => i.name).join(", ") ?? null,
  }));

  return NextResponse.json({
    customer: customer
      ? {
          ...customer,
          lastCompletedAppointmentAt: customer.lastCompletedAppointmentAt?.toISOString() ?? null,
          lastSpentAmount:   customer.lastSpentAmount   ? Number(customer.lastSpentAmount)   : null,
          totalSpentLast60d: customer.totalSpentLast60d ? Number(customer.totalSpentLast60d) : null,
          avgTicketLast60d:  customer.avgTicketLast60d  ? Number(customer.avgTicketLast60d)  : null,
          totalSpent:        Number(customer.totalSpent),
          avgTicket:         Number(customer.avgTicket),
        }
      : null,
    recentAppointments: recentSerialized,
  });
}
