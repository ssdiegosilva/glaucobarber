import { NextResponse } from "next/server";
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

// PATCH /api/goals/unlock-today
// Adds today's day-of-month to extraWorkDays so the off-day override is lifted
export async function PATCH() {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();
  const today = now.getDate(); // 1-31

  const goal = await prisma.goal.findUnique({
    where: { barbershopId_month_year: { barbershopId: session.user.barbershopId, month, year } },
  });

  if (!goal) return NextResponse.json({ error: "Meta do mês não encontrada" }, { status: 404 });

  const extraWorkDays = goal.extraWorkDays.includes(today)
    ? goal.extraWorkDays
    : [...goal.extraWorkDays, today];

  const workingDaysCount = calcWorkingDays(month, year, goal.offDaysOfWeek, goal.extraOffDays, extraWorkDays);

  await prisma.goal.update({
    where: { barbershopId_month_year: { barbershopId: session.user.barbershopId, month, year } },
    data:  { extraWorkDays, workingDaysCount },
  });

  return NextResponse.json({ ok: true, extraWorkDays, workingDaysCount });
}
