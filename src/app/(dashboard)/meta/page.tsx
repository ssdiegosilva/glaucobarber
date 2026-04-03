import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { MetaClient } from "./meta-client";
import { getPlan, hasFeature } from "@/lib/billing";
import { UpgradeWall } from "@/components/billing/UpgradeWall";
import {
  startOfMonth, endOfMonth, startOfDay, endOfDay,
  startOfYear, endOfYear, format,
} from "date-fns";
import { ptBR } from "date-fns/locale";

export default async function MetaPage() {
  const session = await auth();
  if (!session?.user?.barbershopId) redirect("/login");

  const barbershopId = session.user.barbershopId;

  const { effectiveTier } = await getPlan(barbershopId);
  if (!hasFeature(effectiveTier, "meta")) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Metas" subtitle="Acompanhamento de metas diárias e mensais" userName={session.user.name} />
        <UpgradeWall
          feature="Metas"
          requiredPlan="STARTER"
          description="Defina metas de faturamento, acompanhe o progresso diário e use a IA para sugerir metas realistas."
        />
      </div>
    );
  }

  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();

  const thisStart = startOfMonth(now);
  const thisEnd   = endOfMonth(now);
  const dayStart  = startOfDay(now);
  const dayEnd    = endOfDay(now);
  const yearStart = startOfYear(now);
  const yearEnd   = endOfYear(now);

  const [
    goal,
    allGoals,
    thisMonthAgg,
    todayAgg,
    yearAppointments,
    dailyRevenueRaw,
    dailyScheduledRaw,
  ] = await Promise.all([
    prisma.goal.findFirst({ where: { barbershopId, month, year } }),
    prisma.goal.findMany({ where: { barbershopId, year }, orderBy: { month: "asc" } }),
    prisma.appointment.aggregate({
      where: { barbershopId, status: "COMPLETED", scheduledAt: { gte: thisStart, lte: thisEnd } },
      _sum: { price: true }, _count: { _all: true },
    }),
    prisma.appointment.aggregate({
      where: { barbershopId, status: "COMPLETED", scheduledAt: { gte: dayStart, lte: dayEnd } },
      _sum: { price: true },
    }),
    prisma.appointment.findMany({
      where:  { barbershopId, status: "COMPLETED", scheduledAt: { gte: yearStart, lte: yearEnd } },
      select: { scheduledAt: true, price: true },
    }),
    prisma.appointment.findMany({
      where:  { barbershopId, status: "COMPLETED", scheduledAt: { gte: thisStart, lte: thisEnd } },
      select: { scheduledAt: true, price: true },
    }),
    prisma.appointment.findMany({
      where:  { barbershopId, status: { in: ["SCHEDULED", "CONFIRMED"] }, scheduledAt: { gte: now, lte: thisEnd } },
      select: { scheduledAt: true },
    }),
  ]);

  // ── Revenue aggregations ─────────────────────────────────────
  const revenueThisMonth = Number(thisMonthAgg._sum.price ?? 0);
  const todayRevenue     = Number(todayAgg._sum.price ?? 0);

  // ── Daily revenue map ────────────────────────────────────────
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

  // ── Annual chart data ────────────────────────────────────────
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

  // ── All goals serialized ─────────────────────────────────────
  const MONTH_LABELS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const allGoalsSerialized = allGoals.map((g) => ({
    id:               g.id,
    month:            g.month,
    year:             g.year,
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

  // ── Is today an off day? ─────────────────────────────────────
  const todayDow = now.getDay();
  const todayDate = now.getDate();
  const isOffDay = goal
    ? (goal.offDaysOfWeek ?? []).includes(todayDow) &&
      !(goal.extraWorkDays ?? []).includes(todayDate)
    : false;

  const monthLabel = format(now, "MMMM yyyy", { locale: ptBR });

  return (
    <div className="flex flex-col h-full">
      <Header title="Metas" subtitle={`Mês atual: ${monthLabel}`} userName={session.user.name} />
      <div className="p-4 sm:p-6">
        <MetaClient
          month={month}
          year={year}
          monthLabel={monthLabel}
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
          revenueThisMonth={revenueThisMonth}
          todayRevenue={todayRevenue}
          isOffDay={isOffDay}
          revenueByDay={revenueByDay}
          scheduledByDay={scheduledByDay}
          allGoals={allGoalsSerialized}
          annualMonths={annualMonths}
        />
      </div>
    </div>
  );
}
