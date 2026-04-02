import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { FinanceiroClient } from "./financeiro-client";
import { getPlan, hasFeature } from "@/lib/billing";
import { UpgradeWall } from "@/components/billing/UpgradeWall";
import {
  startOfMonth, endOfMonth, subMonths, format,
  eachDayOfInterval, startOfYear, endOfYear,
} from "date-fns";
import { ptBR } from "date-fns/locale";

export default async function FinanceiroPage() {
  const session = await auth();
  if (!session?.user?.barbershopId) redirect("/login");

  const barbershopId = session.user.barbershopId;

  const { tier } = await getPlan(barbershopId);
  if (!hasFeature(tier, "financeiro")) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Gestão Financeira" subtitle="Metas e análise de faturamento" userName={session.user.name} />
        <UpgradeWall
          feature="Gestão Financeira"
          requiredPlan="PRO"
          description="Defina metas de faturamento, acompanhe o progresso diário e use a IA para sugerir metas realistas."
        />
      </div>
    );
  }

  const now          = new Date();
  const month        = now.getMonth() + 1;
  const year         = now.getFullYear();

  const thisStart  = startOfMonth(now);
  const thisEnd    = endOfMonth(now);
  const prevStart  = startOfMonth(subMonths(now, 1));
  const prevEnd    = endOfMonth(subMonths(now, 1));
  const yearStart  = startOfYear(now);
  const yearEnd    = endOfYear(now);

  const [
    thisMonthAgg,
    prevMonthAgg,
    thisMonthCount,
    prevMonthCount,
    goal,
    byService,
    discountPayments,
    allGoals,
    yearAppointments,
    dailyRevenueRaw,
    dailyScheduledRaw,
  ] = await Promise.all([
    prisma.appointment.aggregate({
      where: { barbershopId, status: "COMPLETED", scheduledAt: { gte: thisStart, lte: thisEnd } },
      _sum: { price: true }, _count: { _all: true },
    }),
    prisma.appointment.aggregate({
      where: { barbershopId, status: "COMPLETED", scheduledAt: { gte: prevStart, lte: prevEnd } },
      _sum: { price: true }, _count: { _all: true },
    }),
    prisma.appointment.count({
      where: { barbershopId, status: { notIn: ["CANCELLED", "NO_SHOW"] }, scheduledAt: { gte: thisStart, lte: thisEnd } },
    }),
    prisma.appointment.count({
      where: { barbershopId, status: { notIn: ["CANCELLED", "NO_SHOW"] }, scheduledAt: { gte: prevStart, lte: prevEnd } },
    }),
    prisma.goal.findFirst({ where: { barbershopId, month, year } }),
    prisma.appointment.findMany({
      where:  { barbershopId, status: "COMPLETED", scheduledAt: { gte: thisStart, lte: thisEnd } },
      select: { price: true, service: { select: { id: true, name: true, category: true } } },
    }),
    prisma.payment.findMany({
      where: { barbershopId, domain: "SHOP_OFFER", discountValue: { gt: 0 }, createdAt: { gte: thisStart, lte: thisEnd } },
      select: {
        id: true, discountValue: true, paidValue: true, amount: true, paidAt: true, createdAt: true,
        customer:    { select: { name: true } },
        appointment: { select: { scheduledAt: true, service: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // All goals for current year (Metas tab)
    prisma.goal.findMany({
      where:   { barbershopId, year },
      orderBy: { month: "asc" },
    }),
    // Full year appointments for annual chart
    prisma.appointment.findMany({
      where:  { barbershopId, status: "COMPLETED", scheduledAt: { gte: yearStart, lte: yearEnd } },
      select: { scheduledAt: true, price: true },
    }),
    // Daily completed revenue this month (for calendar color coding)
    prisma.appointment.findMany({
      where:  { barbershopId, status: "COMPLETED", scheduledAt: { gte: thisStart, lte: thisEnd } },
      select: { scheduledAt: true, price: true },
    }),
    // Upcoming scheduled appointments this month (for gold indicator)
    prisma.appointment.findMany({
      where:  { barbershopId, status: { in: ["SCHEDULED", "CONFIRMED"] }, scheduledAt: { gte: now, lte: thisEnd } },
      select: { scheduledAt: true },
    }),
  ]);

  // ── Current month ────────────────────────────────────────────
  const revenueThisMonth = Number(thisMonthAgg._sum.price ?? 0);
  const revenuePrevMonth = Number(prevMonthAgg._sum.price ?? 0);
  const completedThis    = thisMonthAgg._count._all;
  const completedPrev    = prevMonthAgg._count._all;
  const avgTicket        = completedThis > 0 ? revenueThisMonth / completedThis : 0;
  const avgTicketPrev    = completedPrev > 0 ? revenuePrevMonth / completedPrev : 0;

  // ── By service ───────────────────────────────────────────────
  const svcMap = new Map<string, { name: string; category: string; revenue: number; count: number }>();
  for (const appt of byService) {
    const svcId = appt.service?.id ?? "__none__";
    const entry = svcMap.get(svcId);
    if (entry) { entry.revenue += Number(appt.price ?? 0); entry.count += 1; }
    else svcMap.set(svcId, { name: appt.service?.name ?? "Sem serviço", category: appt.service?.category ?? "OTHER", revenue: Number(appt.price ?? 0), count: 1 });
  }
  const byServiceSerialized = [...svcMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 20);

  // ── Discounts ────────────────────────────────────────────────
  const daysInMonth = eachDayOfInterval({ start: thisStart, end: thisEnd });
  const discountByDayMap = new Map<string, number>(daysInMonth.map((d) => [format(d, "dd/MM"), 0]));
  for (const p of discountPayments) {
    const k = format(p.createdAt, "dd/MM");
    discountByDayMap.set(k, (discountByDayMap.get(k) ?? 0) + Number(p.discountValue ?? 0));
  }
  const discountByDay  = [...discountByDayMap.entries()].map(([day, total]) => ({ day, total }));
  const discountList   = discountPayments.map((p) => ({
    id: p.id,
    customerName:   p.customer?.name ?? "—",
    serviceName:    p.appointment?.service?.name ?? "—",
    date:           format(p.paidAt ?? p.createdAt, "dd/MM/yyyy"),
    originalAmount: Number(p.amount),
    discountValue:  Number(p.discountValue ?? 0),
    paidValue:      Number(p.paidValue ?? 0),
  }));
  const totalDiscountMonth = discountList.reduce((s, d) => s + d.discountValue, 0);

  // ── Annual chart ────────────────────────────────────────────
  const revenueByMonth = new Map<number, number>();
  const countByMonth   = new Map<number, number>();
  for (const a of yearAppointments) {
    const m = a.scheduledAt.getMonth() + 1;
    revenueByMonth.set(m, (revenueByMonth.get(m) ?? 0) + Number(a.price ?? 0));
    countByMonth.set(m, (countByMonth.get(m) ?? 0) + 1);
  }
  const goalByMonth = new Map(allGoals.map((g) => [g.month, Number(g.revenueTarget ?? 0)]));
  const annualMonths = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return {
      month:   m,
      label:   format(new Date(year, i, 1), "MMM", { locale: ptBR }),
      revenue: revenueByMonth.get(m) ?? 0,
      count:   countByMonth.get(m) ?? 0,
      goal:    goalByMonth.get(m) ?? null,
    };
  });

  // ── Daily revenue map for current month ─────────────────────
  const revenueByDay: Record<number, number> = {};
  for (const a of dailyRevenueRaw) {
    const d = a.scheduledAt.getDate();
    revenueByDay[d] = (revenueByDay[d] ?? 0) + Number(a.price ?? 0);
  }

  // ── Upcoming scheduled appointments per day ─────────────────
  const scheduledByDay: Record<number, number> = {};
  for (const a of dailyScheduledRaw) {
    const d = a.scheduledAt.getDate();
    scheduledByDay[d] = (scheduledByDay[d] ?? 0) + 1;
  }

  // ── All goals serialized ────────────────────────────────────
  const MONTH_LABELS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const allGoalsSerialized = allGoals.map((g) => ({
    id:               g.id,
    month:            g.month,
    monthLabel:       MONTH_LABELS[g.month - 1] ?? String(g.month),
    revenueTarget:    g.revenueTarget ? Number(g.revenueTarget) : null,
    revenueActual:    revenueByMonth.get(g.month) ?? 0,
    isPast:           g.month < month,
    isCurrent:        g.month === month,
    offDaysOfWeek:    g.offDaysOfWeek ?? [],
    extraOffDays:     g.extraOffDays  ?? [],
    extraWorkDays:    g.extraWorkDays ?? [],
    workingDaysCount: g.workingDaysCount ?? null,
  }));

  const monthLabel = format(now, "MMMM yyyy", { locale: ptBR });

  return (
    <div className="flex flex-col h-full">
      <Header title="Financeiro" subtitle={`Mês atual: ${monthLabel}`} userName={session.user.name} />
      <div className="p-6 overflow-y-auto">
        <FinanceiroClient
          month={month}
          year={year}
          monthLabel={monthLabel}
          revenueThisMonth={revenueThisMonth}
          revenuePrevMonth={revenuePrevMonth}
          completedThis={completedThis}
          completedPrev={completedPrev}
          totalAppointmentsThis={thisMonthCount}
          totalAppointmentsPrev={prevMonthCount}
          avgTicket={avgTicket}
          avgTicketPrev={avgTicketPrev}
          goal={goal ? {
            id:                goal.id,
            revenueTarget:     goal.revenueTarget ? Number(goal.revenueTarget) : null,
            appointmentTarget: goal.appointmentTarget ?? null,
            notes:             goal.notes ?? null,
            offDaysOfWeek:     goal.offDaysOfWeek ?? [],
            extraOffDays:      goal.extraOffDays  ?? [],
            extraWorkDays:     goal.extraWorkDays ?? [],
            workingDaysCount:  goal.workingDaysCount ?? null,
          } : null}
          revenueByDay={revenueByDay}
          scheduledByDay={scheduledByDay}
          byService={byServiceSerialized}
          discountByDay={discountByDay}
          discountList={discountList}
          totalDiscountMonth={totalDiscountMonth}
          annualMonths={annualMonths}
          allGoals={allGoalsSerialized}
        />
      </div>
    </div>
  );
}
