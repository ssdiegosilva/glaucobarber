import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDaysInMonth } from "date-fns";

/** Returns how many days in the given month fall on working days */
function calcWorkingDays(
  month: number, year: number,
  offDaysOfWeek: number[],
  extraOffDays: number[] = [],
  extraWorkDays: number[] = [],
): number {
  const total = getDaysInMonth(new Date(year, month - 1, 1));
  let count = 0;
  for (let d = 1; d <= total; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    const isOffWeekday = offDaysOfWeek.includes(dow);
    const isExtraOff   = extraOffDays.includes(d);
    const isExtraWork  = extraWorkDays.includes(d);
    // Working if: (not off weekday OR explicitly unlocked) AND NOT explicitly blocked
    if ((!isOffWeekday || isExtraWork) && !isExtraOff) count++;
  }
  return count;
}

/** POST or PUT (upsert) a monthly goal */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { month, year, revenueTarget, appointmentTarget, notes, offDaysOfWeek, extraOffDays, extraWorkDays } = await req.json();
  if (!month || !year) return NextResponse.json({ error: "month e year obrigatórios" }, { status: 400 });

  const offDays:   number[] = Array.isArray(offDaysOfWeek) ? offDaysOfWeek.map(Number)  : [];
  const extraOff:  number[] = Array.isArray(extraOffDays)  ? extraOffDays.map(Number)   : [];
  const extraWork: number[] = Array.isArray(extraWorkDays) ? extraWorkDays.map(Number)  : [];
  const workingDaysCount = calcWorkingDays(Number(month), Number(year), offDays, extraOff, extraWork);

  const goal = await prisma.goal.upsert({
    where:  { barbershopId_month_year: { barbershopId: session.user.barbershopId, month: Number(month), year: Number(year) } },
    create: {
      barbershopId:      session.user.barbershopId,
      month:             Number(month),
      year:              Number(year),
      revenueTarget:     revenueTarget ?? null,
      appointmentTarget: appointmentTarget ?? null,
      notes:             notes ?? null,
      offDaysOfWeek:     offDays,
      extraOffDays:      extraOff,
      extraWorkDays:     extraWork,
      workingDaysCount,
    },
    update: {
      revenueTarget:     revenueTarget ?? null,
      appointmentTarget: appointmentTarget ?? null,
      notes:             notes ?? null,
      offDaysOfWeek:     offDays,
      extraOffDays:      extraOff,
      extraWorkDays:     extraWork,
      workingDaysCount,
    },
  });

  return NextResponse.json({ goal });
}

/** DELETE a monthly goal */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { month, year } = await req.json();
  if (!month || !year) return NextResponse.json({ error: "month e year obrigatórios" }, { status: 400 });

  await prisma.goal.deleteMany({
    where: { barbershopId: session.user.barbershopId, month: Number(month), year: Number(year) },
  });

  return NextResponse.json({ ok: true });
}
