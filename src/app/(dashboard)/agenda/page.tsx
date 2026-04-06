import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AgendaClient } from "./agenda-client";
import type { AgendaAppointment } from "./agenda-client";
import type { AgendaKPIs } from "./components/AgendaKPICards";

const TOTAL_SLOTS = 20;

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.barbershopId) redirect("/login");

  const barbershopId = session.user.barbershopId;
  const { date: dateParam } = await searchParams;

  // Parse requested date (default: today)
  const target  = dateParam ? new Date(`${dateParam}T12:00:00`) : new Date();
  const dateIso = format(target, "yyyy-MM-dd");

  // Brazil is permanently UTC-3 (no DST since 2019).
  // Trinks times are stored as real UTC (midnight BRT = 03:00 UTC).
  const [_y, _m, _d] = dateIso.split("-").map(Number);
  const start = new Date(Date.UTC(_y, _m - 1, _d,     3,  0,  0,   0)); // 00:00 BRT = 03:00 UTC
  const end   = new Date(Date.UTC(_y, _m - 1, _d + 1, 2, 59, 59, 999)); // 23:59:59 BRT = 02:59:59 UTC next day

  const targetMonth = target.getMonth() + 1;
  const targetYear  = target.getFullYear();
  const targetDay   = target.getDate();
  const targetDow   = target.getDay(); // 0=Sun, 6=Sat

  const [appointments, integration, barbershop, goal, barberMembers] = await Promise.all([
    prisma.appointment.findMany({
      where: { barbershopId, scheduledAt: { gte: start, lte: end } },
      include: {
        customer: { select: { name: true } },
        service:  { select: { name: true } },
        barber:   { select: { id: true, name: true } },
      },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.integration.findUnique({ where: { barbershopId }, select: { configJson: true, status: true } }),
    prisma.barbershop.findUnique({ where: { id: barbershopId }, select: { agendaStartHour: true, agendaEndHour: true } }),
    prisma.goal.findUnique({
      where: { barbershopId_month_year: { barbershopId, month: targetMonth, year: targetYear } },
      select: { offDaysOfWeek: true, extraOffDays: true, extraWorkDays: true },
    }),
    prisma.membership.findMany({
      where: { barbershopId, role: { in: ["BARBER", "OWNER"] }, active: true },
      select: { userId: true, user: { select: { id: true, name: true } }, role: true },
    }),
  ]);

  // Determine if this day is an off day
  const isOffWeekday = goal?.offDaysOfWeek.includes(targetDow) ?? false;
  const isExtraOff   = goal?.extraOffDays.includes(targetDay) ?? false;
  const isExtraWork  = goal?.extraWorkDays.includes(targetDay) ?? false;
  const isDayOff     = (isOffWeekday && !isExtraWork) || isExtraOff;

  // Build barbers list for the client
  const barbers = barberMembers.map((m) => ({
    id:   m.user.id,
    name: m.user.name ?? "Barbeiro",
    role: m.role,
  }));

  const serialized: AgendaAppointment[] = appointments.map((a) => ({
    id:           a.id,
    trinksId:     a.trinksId,
    customerName: a.customer?.name ?? "Cliente",
    serviceName:  a.service?.name ?? null,
    scheduledAt:  a.scheduledAt.toISOString(),
    durationMin:  a.durationMin,
    status:       a.status,
    price:        a.price ? Number(a.price) : null,
    profissional: a.barber?.name ?? null,
    barberId:     a.barberId ?? null,
    notes:        a.notes,
  }));

  const active = appointments.filter((a) => !["CANCELLED", "NO_SHOW"].includes(a.status));
  const kpis: AgendaKPIs = {
    revenueCompleted: appointments.filter((a) => a.status === "COMPLETED").reduce((s, a) => s + Number(a.price ?? 0), 0),
    revenueProjected: appointments.filter((a) => ["SCHEDULED","CONFIRMED","IN_PROGRESS"].includes(a.status)).reduce((s, a) => s + Number(a.price ?? 0), 0),
    completedCount:   appointments.filter((a) => a.status === "COMPLETED").length,
    cancelledCount:   appointments.filter((a) => a.status === "CANCELLED").length,
    noShowCount:      appointments.filter((a) => a.status === "NO_SHOW").length,
    occupancyRate:    Math.min(active.length / TOTAL_SLOTS, 1),
    freeSlots:        Math.max(TOTAL_SLOTS - active.length, 0),
    totalSlots:       TOTAL_SLOTS,
  };

  const hasTrinks       = !!integration?.configJson && integration.status === "ACTIVE";
  const agendaStartHour = barbershop?.agendaStartHour ?? 6;
  const agendaEndHour   = barbershop?.agendaEndHour   ?? 24;
  const dateLabel       = format(target, "EEEE, dd 'de' MMMM", { locale: ptBR });
  const currentYear     = new Date().getFullYear();

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Agenda"
        subtitle="Visão operacional do dia"
        userName={session.user.name}
      />
      <div className="p-6">
        <AgendaClient
          appointments={serialized}
          barbers={barbers}
          kpis={kpis}
          date={dateLabel}
          dateIso={dateIso}
          hasTrinks={hasTrinks}
          agendaStartHour={agendaStartHour}
          agendaEndHour={agendaEndHour}
          currentYear={currentYear}
          isDayOff={isDayOff}
        />
      </div>
    </div>
  );
}
