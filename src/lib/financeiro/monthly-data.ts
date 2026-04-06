import { prisma } from "@/lib/prisma";
import {
  startOfMonth, endOfMonth, subMonths, eachDayOfInterval, format,
} from "date-fns";

export interface DiscountEntry {
  id:             string;
  customerName:   string;
  serviceName:    string;
  date:           string;
  originalAmount: number;
  discountValue:  number;
  paidValue:      number;
}

export interface MonthlyData {
  month:                  number;
  year:                   number;
  revenue:                number;
  revenuePrevMonth:       number;
  completedCount:         number;
  completedPrevMonth:     number;
  totalAppointments:      number;
  totalAppointmentsPrev:  number;
  avgTicket:              number;
  avgTicketPrev:          number;
  goal: {
    revenueTarget:     number | null;
    appointmentTarget: number | null;
    workingDaysCount:  number | null;
    offDaysOfWeek:     number[];
    extraOffDays:      number[];
    extraWorkDays:     number[];
  } | null;
  dailyRevenue:  { day: number; revenue: number }[];
  dailyScheduled: { day: number; count: number }[];
  byCategory:    { category: string; revenue: number; count: number }[];
  byService:     { name: string; category: string; revenue: number; count: number }[];
  byPaymentMethod: { method: "CARD" | "PIX" | "CASH" | null; revenue: number; count: number }[];
  discounts: {
    total:  number;
    count:  number;
    rate:   number;
    byDay:  { day: string; total: number }[];
    list:   DiscountEntry[];
  };
}

export async function getMonthlyFinanceiroData(
  barbershopId: string,
  month: number,
  year: number,
): Promise<MonthlyData> {
  const date      = new Date(year, month - 1, 1);
  const now       = new Date();
  const thisStart = startOfMonth(date);
  const thisEnd   = endOfMonth(date);
  const prevDate  = subMonths(date, 1);
  const prevStart = startOfMonth(prevDate);
  const prevEnd   = endOfMonth(prevDate);

  const [
    thisAgg,
    prevAgg,
    thisCount,
    prevCount,
    goal,
    appointments,
    discountPayments,
    dailyRevenueRaw,
    dailyScheduledRaw,
    paymentMethodRaw,
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
      where: {
        barbershopId, domain: "SHOP_OFFER", discountValue: { gt: 0 },
        createdAt: { gte: thisStart, lte: thisEnd },
      },
      select: {
        id: true, discountValue: true, paidValue: true, amount: true, paidAt: true, createdAt: true,
        customer:    { select: { name: true } },
        appointment: { select: { scheduledAt: true, service: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.appointment.findMany({
      where:  { barbershopId, status: "COMPLETED", scheduledAt: { gte: thisStart, lte: thisEnd } },
      select: { scheduledAt: true, price: true },
    }),
    prisma.appointment.findMany({
      where:  {
        barbershopId,
        status: { in: ["SCHEDULED", "CONFIRMED"] },
        scheduledAt: { gte: now < thisStart ? thisStart : now, lte: thisEnd },
      },
      select: { scheduledAt: true },
    }),
    prisma.payment.groupBy({
      by:    ["paymentMethod"],
      where: { barbershopId, domain: "BARBERSHOP_SERVICE", paidAt: { gte: thisStart, lte: thisEnd } },
      _sum:  { paidValue: true },
      _count: { _all: true },
    }),
  ]);

  const revenue          = Number(thisAgg._sum.price ?? 0);
  const revenuePrevMonth = Number(prevAgg._sum.price ?? 0);
  const completedCount   = thisAgg._count._all;
  const completedPrev    = prevAgg._count._all;
  const avgTicket        = completedCount > 0 ? revenue / completedCount : 0;
  const avgTicketPrev    = completedPrev  > 0 ? revenuePrevMonth / completedPrev : 0;

  // By service / category
  const svcMap = new Map<string, { name: string; category: string; revenue: number; count: number }>();
  for (const a of appointments) {
    const key   = a.service?.id ?? "__none__";
    const entry = svcMap.get(key);
    const rev   = Number(a.price ?? 0);
    if (entry) { entry.revenue += rev; entry.count += 1; }
    else svcMap.set(key, { name: a.service?.name ?? "Sem serviço", category: a.service?.category ?? "OTHER", revenue: rev, count: 1 });
  }
  const byService = [...svcMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  const catMap = new Map<string, { revenue: number; count: number }>();
  for (const s of byService) {
    const e = catMap.get(s.category);
    if (e) { e.revenue += s.revenue; e.count += s.count; }
    else catMap.set(s.category, { revenue: s.revenue, count: s.count });
  }
  const byCategory = [...catMap.entries()].map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.revenue - a.revenue);

  // Daily revenue
  const dailyRevMap: Record<number, number> = {};
  for (const a of dailyRevenueRaw) {
    const d = a.scheduledAt.getDate();
    dailyRevMap[d] = (dailyRevMap[d] ?? 0) + Number(a.price ?? 0);
  }
  const daysInMonth = eachDayOfInterval({ start: thisStart, end: thisEnd });
  const dailyRevenue = daysInMonth.map((d) => ({ day: d.getDate(), revenue: dailyRevMap[d.getDate()] ?? 0 }));

  // Daily scheduled
  const dailySchedMap: Record<number, number> = {};
  for (const a of dailyScheduledRaw) {
    const d = a.scheduledAt.getDate();
    dailySchedMap[d] = (dailySchedMap[d] ?? 0) + 1;
  }
  const dailyScheduled = daysInMonth.map((d) => ({ day: d.getDate(), count: dailySchedMap[d.getDate()] ?? 0 }));

  // Discounts
  const discountByDayMap = new Map<string, number>(daysInMonth.map((d) => [format(d, "dd/MM"), 0]));
  for (const p of discountPayments) {
    const k = format(p.createdAt, "dd/MM");
    discountByDayMap.set(k, (discountByDayMap.get(k) ?? 0) + Number(p.discountValue ?? 0));
  }
  const discountList: DiscountEntry[] = discountPayments.map((p) => ({
    id:             p.id,
    customerName:   p.customer?.name ?? "—",
    serviceName:    p.appointment?.service?.name ?? "—",
    date:           format(p.paidAt ?? p.createdAt, "dd/MM/yyyy"),
    originalAmount: Number(p.amount),
    discountValue:  Number(p.discountValue ?? 0),
    paidValue:      Number(p.paidValue ?? 0),
  }));
  const totalDiscount = discountList.reduce((s, d) => s + d.discountValue, 0);

  return {
    month,
    year,
    revenue,
    revenuePrevMonth,
    completedCount,
    completedPrevMonth: completedPrev,
    totalAppointments:  thisCount,
    totalAppointmentsPrev: prevCount,
    avgTicket,
    avgTicketPrev,
    goal: goal ? {
      revenueTarget:     goal.revenueTarget     ? Number(goal.revenueTarget)     : null,
      appointmentTarget: goal.appointmentTarget ?? null,
      workingDaysCount:  goal.workingDaysCount  ?? null,
      offDaysOfWeek:     goal.offDaysOfWeek     ?? [],
      extraOffDays:      goal.extraOffDays      ?? [],
      extraWorkDays:     goal.extraWorkDays      ?? [],
    } : null,
    dailyRevenue,
    dailyScheduled,
    byCategory,
    byService,
    byPaymentMethod: paymentMethodRaw.map((r) => ({
      method:  r.paymentMethod as "CARD" | "PIX" | "CASH" | null,
      revenue: Number(r._sum.paidValue ?? 0),
      count:   r._count._all,
    })).sort((a, b) => b.revenue - a.revenue),
    discounts: {
      total: totalDiscount,
      count: discountList.length,
      rate:  revenue > 0 ? totalDiscount / revenue : 0,
      byDay: [...discountByDayMap.entries()].map(([day, total]) => ({ day, total })),
      list:  discountList,
    },
  };
}
