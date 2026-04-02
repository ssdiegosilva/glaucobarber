import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { FinanceiroClient } from "./financeiro-client";
import { startOfMonth, endOfMonth, subMonths, format, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

export default async function FinanceiroPage() {
  const session = await auth();
  if (!session?.user?.barbershopId) redirect("/login");

  const barbershopId = session.user.barbershopId;
  const now          = new Date();
  const month        = now.getMonth() + 1;
  const year         = now.getFullYear();

  const thisStart  = startOfMonth(now);
  const thisEnd    = endOfMonth(now);
  const prevStart  = startOfMonth(subMonths(now, 1));
  const prevEnd    = endOfMonth(subMonths(now, 1));

  const [
    thisMonthAgg,
    prevMonthAgg,
    thisMonthCount,
    prevMonthCount,
    goal,
    byService,
    discountPayments,
  ] = await Promise.all([
    // Revenue realizada este mês
    prisma.appointment.aggregate({
      where: { barbershopId, status: "COMPLETED", scheduledAt: { gte: thisStart, lte: thisEnd } },
      _sum:   { price: true },
      _count: { _all: true },
    }),
    // Revenue realizada mês anterior
    prisma.appointment.aggregate({
      where: { barbershopId, status: "COMPLETED", scheduledAt: { gte: prevStart, lte: prevEnd } },
      _sum:   { price: true },
      _count: { _all: true },
    }),
    // Total de atendimentos (não cancelados) este mês
    prisma.appointment.count({
      where: { barbershopId, status: { notIn: ["CANCELLED", "NO_SHOW"] }, scheduledAt: { gte: thisStart, lte: thisEnd } },
    }),
    // Total de atendimentos (não cancelados) mês anterior
    prisma.appointment.count({
      where: { barbershopId, status: { notIn: ["CANCELLED", "NO_SHOW"] }, scheduledAt: { gte: prevStart, lte: prevEnd } },
    }),
    // Meta do mês atual
    prisma.goal.findFirst({ where: { barbershopId, month, year } }),
    // Revenue por serviço (este mês)
    prisma.appointment.findMany({
      where:   { barbershopId, status: "COMPLETED", scheduledAt: { gte: thisStart, lte: thisEnd } },
      select:  { price: true, service: { select: { id: true, name: true, category: true } } },
    }),

    // Descontos aplicados este mês (payments com discountValue > 0)
    prisma.payment.findMany({
      where: {
        barbershopId,
        domain: "SHOP_OFFER",
        discountValue: { gt: 0 },
        createdAt: { gte: thisStart, lte: thisEnd },
      },
      select: {
        id: true,
        discountValue: true,
        paidValue: true,
        amount: true,
        paidAt: true,
        createdAt: true,
        customer: { select: { name: true } },
        appointment: { select: { scheduledAt: true, service: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const revenueThisMonth = Number(thisMonthAgg._sum.price ?? 0);
  const revenuePrevMonth = Number(prevMonthAgg._sum.price ?? 0);
  const completedThis    = thisMonthAgg._count._all;
  const completedPrev    = prevMonthAgg._count._all;
  const avgTicket        = completedThis > 0 ? revenueThisMonth / completedThis : 0;
  const avgTicketPrev    = completedPrev > 0 ? revenuePrevMonth / completedPrev : 0;

  // Aggregate revenue by service
  const svcMap = new Map<string, { name: string; category: string; revenue: number; count: number }>();
  for (const appt of byService) {
    const svcId   = appt.service?.id   ?? "__none__";
    const svcName = appt.service?.name ?? "Sem serviço";
    const svcCat  = appt.service?.category ?? "OTHER";
    const existing = svcMap.get(svcId);
    if (existing) {
      existing.revenue += Number(appt.price ?? 0);
      existing.count   += 1;
    } else {
      svcMap.set(svcId, { name: svcName, category: svcCat, revenue: Number(appt.price ?? 0), count: 1 });
    }
  }
  const byServiceSerialized = [...svcMap.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 20);

  const monthLabel = format(now, "MMMM yyyy", { locale: ptBR });

  // Build discount-by-day map for the bar chart
  const daysInMonth = eachDayOfInterval({ start: thisStart, end: thisEnd });
  const discountByDayMap = new Map<string, number>();
  for (const d of daysInMonth) {
    discountByDayMap.set(format(d, "dd/MM"), 0);
  }
  for (const p of discountPayments) {
    const dayKey = format(p.createdAt, "dd/MM");
    discountByDayMap.set(dayKey, (discountByDayMap.get(dayKey) ?? 0) + Number(p.discountValue ?? 0));
  }
  const discountByDay = [...discountByDayMap.entries()].map(([day, total]) => ({ day, total }));

  const discountList = discountPayments.map((p) => ({
    id:           p.id,
    customerName: p.customer?.name ?? "—",
    serviceName:  p.appointment?.service?.name ?? "—",
    date:         format(p.paidAt ?? p.createdAt, "dd/MM/yyyy"),
    originalAmount: Number(p.amount),
    discountValue:  Number(p.discountValue ?? 0),
    paidValue:      Number(p.paidValue ?? 0),
  }));

  const totalDiscountMonth = discountList.reduce((s, d) => s + d.discountValue, 0);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Financeiro"
        subtitle={`Acompanhamento de ${monthLabel}`}
        userName={session.user.name}
      />
      <div className="p-6">
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
            id:               goal.id,
            revenueTarget:    goal.revenueTarget  ? Number(goal.revenueTarget)  : null,
            appointmentTarget: goal.appointmentTarget ?? null,
            notes:             goal.notes ?? null,
          } : null}
          byService={byServiceSerialized}
          discountByDay={discountByDay}
          discountList={discountList}
          totalDiscountMonth={totalDiscountMonth}
        />
      </div>
    </div>
  );
}
