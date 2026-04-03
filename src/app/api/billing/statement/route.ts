import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPlan, PLAN_LIMITS, APPOINTMENT_FEE_CENTS, APPOINTMENT_FEE_CAP_CENTS } from "@/lib/billing";

function currentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const barbershopId = session.user.barbershopId;
  const yearMonth    = currentYearMonth();

  const [plan, feeConfigs] = await Promise.all([
    getPlan(barbershopId),
    prisma.platformConfig.findMany({
      where: { key: { in: ["pro_appointment_fee_cents", "pro_appointment_fee_cap_cents", "pro_base_price_cents"] } },
    }),
  ]);

  const feeCents    = parseInt(feeConfigs.find((c) => c.key === "pro_appointment_fee_cents")?.value    ?? "") || APPOINTMENT_FEE_CENTS;
  const feeCap      = parseInt(feeConfigs.find((c) => c.key === "pro_appointment_fee_cap_cents")?.value ?? "") || APPOINTMENT_FEE_CAP_CENTS;
  const baseCents   = parseInt(feeConfigs.find((c) => c.key === "pro_base_price_cents")?.value         ?? "") || 14_900; // R$149

  const limits      = PLAN_LIMITS[plan.tier];
  const hasApptFee  = limits.appointmentFee;

  // Current month events (pending — not yet invoiced)
  const currentEvents = await prisma.billingEvent.findMany({
    where:   { barbershopId, yearMonth, invoicedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id:           true,
      amountCents:  true,
      createdAt:    true,
      appointment: {
        select: {
          scheduledAt: true,
          service:     { select: { name: true } },
          customer:    { select: { name: true } },
        },
      },
    },
  });

  // Past months already invoiced — last 6 months grouped
  const pastEvents = await prisma.billingEvent.findMany({
    where:   { barbershopId, yearMonth: { lt: yearMonth }, invoicedAt: { not: null } },
    orderBy: { createdAt: "desc" },
    select:  { yearMonth: true, amountCents: true },
  });

  // Group past by yearMonth
  const pastByMonth = new Map<string, { yearMonth: string; count: number; totalCents: number }>();
  for (const e of pastEvents) {
    const entry = pastByMonth.get(e.yearMonth);
    if (entry) { entry.count++; entry.totalCents += e.amountCents; }
    else pastByMonth.set(e.yearMonth, { yearMonth: e.yearMonth, count: 1, totalCents: e.amountCents });
  }
  const history = [...pastByMonth.values()]
    .sort((a, b) => b.yearMonth.localeCompare(a.yearMonth))
    .slice(0, 6);

  // Projected next invoice
  const currentTotalCents = currentEvents.reduce((s, e) => s + e.amountCents, 0);
  const cappedCents       = Math.min(currentTotalCents, feeCap);
  const projectedCents    = hasApptFee ? baseCents + cappedCents : baseCents;

  return NextResponse.json({
    yearMonth,
    feeCents,
    feeCap,
    baseCents,
    hasApptFee,
    currentEvents: currentEvents.map((e) => ({
      id:           e.id,
      amountCents:  e.amountCents,
      customerName: e.appointment?.customer?.name ?? "—",
      serviceName:  e.appointment?.service?.name  ?? "—",
      date:         e.appointment?.scheduledAt?.toISOString() ?? e.createdAt.toISOString(),
    })),
    currentTotalCents,
    cappedCents,
    projectedCents,
    history,
  });
}
