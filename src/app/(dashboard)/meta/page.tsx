import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { MetaClient } from "./meta-client";
import { getPlan } from "@/lib/billing";
import { canAccess } from "@/lib/access";
import { UpgradeWall } from "@/components/billing/UpgradeWall";
import { getSegmentTheme } from "@/lib/core/segment";
import {
  startOfMonth, endOfMonth, startOfDay, endOfDay,
  startOfYear, endOfYear, format,
} from "date-fns";
import { ptBR } from "date-fns/locale";

export default async function MetaPage() {
  const session = await auth();
  if (!session?.user?.barbershopId) redirect("/login");

  const barbershopId = session.user.barbershopId;

  // Detect business type from segment
  const segmentTheme = await getSegmentTheme(barbershopId);
  let businessType: "service" | "product" | "mixed" = "service";
  try {
    const modules: string[] = JSON.parse(segmentTheme?.availableModules ?? "[]");
    const hasAgenda  = modules.includes("agenda");
    const hasVisitas = modules.includes("visitas");
    if (hasVisitas && !hasAgenda) businessType = "product";
    else if (hasVisitas && hasAgenda) businessType = "mixed";
  } catch {}

  const { effectiveTier } = await getPlan(barbershopId);
  const allowed = await canAccess(barbershopId, effectiveTier, "meta");
  if (!allowed) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Metas" subtitle="Acompanhamento de metas diárias e mensais" userName={session.user.name} />
        <UpgradeWall
          feature="Metas"
          requiredPlan="PRO"
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
    // Visit (product sales) queries
    visitMonthAgg,
    visitTodayAgg,
    yearVisits,
    dailyVisitRaw,
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
    // Visits: month aggregate
    prisma.visit.aggregate({
      where: { barbershopId, visitedAt: { gte: thisStart, lte: thisEnd } },
      _sum: { amount: true },
    }),
    // Visits: today aggregate
    prisma.visit.aggregate({
      where: { barbershopId, visitedAt: { gte: dayStart, lte: dayEnd } },
      _sum: { amount: true },
    }),
    // Visits: year (for annual chart)
    prisma.visit.findMany({
      where:  { barbershopId, visitedAt: { gte: yearStart, lte: yearEnd } },
      select: { visitedAt: true, amount: true },
    }),
    // Visits: daily breakdown this month
    prisma.visit.findMany({
      where:  { barbershopId, visitedAt: { gte: thisStart, lte: thisEnd } },
      select: { visitedAt: true, amount: true },
    }),
  ]);

  // ── Revenue aggregations (appointments + visits) ─────────────
  const revenueThisMonth = Number(thisMonthAgg._sum.price ?? 0) + Number(visitMonthAgg._sum.amount ?? 0);
  const todayRevenue     = Number(todayAgg._sum.price ?? 0) + Number(visitTodayAgg._sum.amount ?? 0);

  // ── Daily revenue map (appointments + visits) ────────────────
  const revenueByDay: Record<number, number> = {};
  for (const a of dailyRevenueRaw) {
    const d = a.scheduledAt.getDate();
    revenueByDay[d] = (revenueByDay[d] ?? 0) + Number(a.price ?? 0);
  }
  for (const v of dailyVisitRaw) {
    const d = v.visitedAt.getDate();
    revenueByDay[d] = (revenueByDay[d] ?? 0) + Number(v.amount ?? 0);
  }

  // ── Upcoming scheduled appointments per day ─────────────────
  const scheduledByDay: Record<number, number> = {};
  for (const a of dailyScheduledRaw) {
    const d = a.scheduledAt.getDate();
    scheduledByDay[d] = (scheduledByDay[d] ?? 0) + 1;
  }

  // ── Annual chart data (appointments + visits) ────────────────
  const revenueByMonth = new Map<number, number>();
  const countByMonth   = new Map<number, number>();
  for (const a of yearAppointments) {
    const m = a.scheduledAt.getMonth() + 1;
    revenueByMonth.set(m, (revenueByMonth.get(m) ?? 0) + Number(a.price ?? 0));
    countByMonth.set(m, (countByMonth.get(m) ?? 0) + 1);
  }
  for (const v of yearVisits) {
    const m = v.visitedAt.getMonth() + 1;
    revenueByMonth.set(m, (revenueByMonth.get(m) ?? 0) + Number(v.amount ?? 0));
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
          businessType={businessType}
        />
      </div>
    </div>
  );
}
