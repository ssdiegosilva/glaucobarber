import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { agendaStartHour, agendaEndHour } = await req.json();

  if (
    typeof agendaStartHour !== "number" ||
    typeof agendaEndHour   !== "number" ||
    agendaStartHour < 0 || agendaStartHour > 23 ||
    agendaEndHour   < 1 || agendaEndHour   > 24 ||
    agendaEndHour  <= agendaStartHour
  ) {
    return NextResponse.json({ error: "Horários inválidos" }, { status: 400 });
  }

  await prisma.barbershop.update({
    where: { id: session.user.barbershopId },
    data:  { agendaStartHour, agendaEndHour },
  });

  return NextResponse.json({ ok: true });
}
