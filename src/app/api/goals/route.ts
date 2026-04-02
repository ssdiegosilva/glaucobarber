import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** POST or PUT (upsert) a monthly goal */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { month, year, revenueTarget, appointmentTarget, notes } = await req.json();
  if (!month || !year) return NextResponse.json({ error: "month e year obrigatórios" }, { status: 400 });

  const goal = await prisma.goal.upsert({
    where:  { barbershopId_month_year: { barbershopId: session.user.barbershopId, month: Number(month), year: Number(year) } },
    create: { barbershopId: session.user.barbershopId, month: Number(month), year: Number(year), revenueTarget: revenueTarget ?? null, appointmentTarget: appointmentTarget ?? null, notes: notes ?? null },
    update: { revenueTarget: revenueTarget ?? null, appointmentTarget: appointmentTarget ?? null, notes: notes ?? null },
  });

  return NextResponse.json({ goal });
}
