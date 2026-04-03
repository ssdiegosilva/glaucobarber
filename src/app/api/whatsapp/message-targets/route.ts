import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/whatsapp/message-targets?filter=post_sale|em_risco|inactive|reactivated|all
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const barbershopId = session.user.barbershopId;
  const filter = req.nextUrl.searchParams.get("filter") ?? "all";

  const baseWhere = { barbershopId, deletedAt: null, phone: { not: null }, doNotContact: { not: true } };

  const select = {
    id: true,
    name: true,
    phone: true,
    lastWhatsappSentAt: true,
    lastCompletedAppointmentAt: true,
  };

  let where: object = baseWhere;

  if (filter === "post_sale") {
    // Recém-atendidos: postSaleStatus RECENTE
    where = { ...baseWhere, postSaleStatus: "RECENTE" };
  } else if (filter === "em_risco") {
    where = { ...baseWhere, postSaleStatus: "EM_RISCO" };
  } else if (filter === "inactive") {
    where = { ...baseWhere, postSaleStatus: "INATIVO" };
  } else if (filter === "reactivated") {
    where = { ...baseWhere, postSaleStatus: "REATIVADO" };
  }
  // "all" → sem filtro de status

  const rows = await prisma.customer.findMany({
    where,
    select,
    orderBy: { name: "asc" },
    take: 300,
  });

  const customers = rows.map((c) => ({
    id:                 c.id,
    name:               c.name,
    phone:              c.phone,
    lastWhatsappSentAt: c.lastWhatsappSentAt?.toISOString() ?? null,
    lastAppointmentAt:  c.lastCompletedAppointmentAt?.toISOString() ?? null,
  }));

  return NextResponse.json({ customers });
}
