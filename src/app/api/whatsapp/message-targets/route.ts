import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { subDays } from "date-fns";

// GET /api/whatsapp/message-targets?filter=post_sale|inactive_30|inactive_60|all
// Retorna clientes elegíveis para envio em massa via bot.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const barbershopId = session.user.barbershopId;
  const filter = req.nextUrl.searchParams.get("filter") ?? "all";
  const now = new Date();

  type CustomerResult = {
    id: string;
    name: string;
    phone: string | null;
    lastWhatsappSentAt: Date | null;
    lastAppointmentAt: Date | null;
  };

  let customers: CustomerResult[] = [];

  if (filter === "post_sale") {
    // Clientes com atendimento concluído nos últimos 14 dias (igual ao pós-venda)
    // E que não receberam WhatsApp nas últimas 48h (ou nunca)
    const cutoff48h = subDays(now, 2);
    const cutoff7d  = subDays(now, 14);

    const rows = await prisma.customer.findMany({
      where: {
        barbershopId,
        deletedAt: null,
        phone: { not: null },
        OR: [
          { lastWhatsappSentAt: null },
          { lastWhatsappSentAt: { lt: cutoff48h } },
        ],
        appointments: {
          some: {
            status:      "COMPLETED",
            scheduledAt: { gte: cutoff7d },
          },
        },
      },
      select: {
        id: true, name: true, phone: true, lastWhatsappSentAt: true,
        appointments: {
          where:   { status: "COMPLETED" },
          orderBy: { scheduledAt: "desc" },
          take:    1,
          select:  { scheduledAt: true },
        },
      },
      take: 200,
    });

    customers = rows.map((c) => ({
      id:                c.id,
      name:              c.name,
      phone:             c.phone,
      lastWhatsappSentAt: c.lastWhatsappSentAt,
      lastAppointmentAt: c.appointments[0]?.scheduledAt ?? null,
    }));

  } else if (filter === "inactive_30" || filter === "inactive_60") {
    const days   = filter === "inactive_30" ? 30 : 60;
    const cutoff = subDays(now, days);

    const rows = await prisma.customer.findMany({
      where: {
        barbershopId,
        deletedAt: null,
        phone: { not: null },
        appointments: {
          none: {
            status:      "COMPLETED",
            scheduledAt: { gte: cutoff },
          },
        },
      },
      select: {
        id: true, name: true, phone: true, lastWhatsappSentAt: true,
        appointments: {
          where:   { status: "COMPLETED" },
          orderBy: { scheduledAt: "desc" },
          take:    1,
          select:  { scheduledAt: true },
        },
      },
      take: 200,
    });

    customers = rows.map((c) => ({
      id:                c.id,
      name:              c.name,
      phone:             c.phone,
      lastWhatsappSentAt: c.lastWhatsappSentAt,
      lastAppointmentAt: c.appointments[0]?.scheduledAt ?? null,
    }));

  } else {
    // all — todos com telefone
    const rows = await prisma.customer.findMany({
      where: { barbershopId, deletedAt: null, phone: { not: null } },
      select: {
        id: true, name: true, phone: true, lastWhatsappSentAt: true,
        appointments: {
          where:   { status: "COMPLETED" },
          orderBy: { scheduledAt: "desc" },
          take:    1,
          select:  { scheduledAt: true },
        },
      },
      take: 300,
      orderBy: { name: "asc" },
    });

    customers = rows.map((c) => ({
      id:                c.id,
      name:              c.name,
      phone:             c.phone,
      lastWhatsappSentAt: c.lastWhatsappSentAt,
      lastAppointmentAt: c.appointments[0]?.scheduledAt ?? null,
    }));
  }

  return NextResponse.json({ customers });
}
