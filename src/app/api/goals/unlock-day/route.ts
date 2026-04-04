import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDaysInMonth } from "date-fns";

function calcWorkingDays(
  month: number, year: number,
  offDaysOfWeek: number[],
  extraOffDays: number[],
  extraWorkDays: number[],
): number {
  const total = getDaysInMonth(new Date(year, month - 1, 1));
  let count = 0;
  for (let d = 1; d <= total; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if ((!offDaysOfWeek.includes(dow) || extraWorkDays.includes(d)) && !extraOffDays.includes(d)) count++;
  }
  return count;
}

// PATCH /api/goals/unlock-day
// Adds a specific day-of-month to extraWorkDays so the off-day override is lifted
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { day, month, year } = await req.json();
  if (!day || !month || !year) {
    return NextResponse.json({ error: "day, month e year obrigatórios" }, { status: 400 });
  }

  const goal = await prisma.goal.findUnique({
    where: { barbershopId_month_year: { barbershopId: session.user.barbershopId, month: Number(month), year: Number(year) } },
  });

  if (!goal) return NextResponse.json({ error: "Meta do mês não encontrada" }, { status: 404 });

  const dayNum = Number(day);
  const extraWorkDays = goal.extraWorkDays.includes(dayNum)
    ? goal.extraWorkDays
    : [...goal.extraWorkDays, dayNum];

  const workingDaysCount = calcWorkingDays(Number(month), Number(year), goal.offDaysOfWeek, goal.extraOffDays, extraWorkDays);

  await prisma.goal.update({
    where: { barbershopId_month_year: { barbershopId: session.user.barbershopId, month: Number(month), year: Number(year) } },
    data: { extraWorkDays, workingDaysCount },
  });

  return NextResponse.json({ ok: true, extraWorkDays, workingDaysCount });
}
