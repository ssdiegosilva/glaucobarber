import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { startOfDay, endOfDay, format } from "date-fns";
import { AgendaClient } from "./agenda-client";
import type { AgendaAppointment } from "./agenda-client";
import type { AgendaKPIs } from "./components/AgendaKPICards";

const TOTAL_SLOTS = 20;

export default async function AgendaPage() {
  const session = await auth();
  if (!session?.user?.barbershopId) redirect("/login");

  const barbershopId = session.user.barbershopId;
  const now   = new Date();
  const start = startOfDay(now);
  const end   = endOfDay(now);

  const [appointments, integration] = await Promise.all([
    prisma.appointment.findMany({
      where: { barbershopId, scheduledAt: { gte: start, lte: end } },
      include: {
        customer: { select: { name: true } },
        service:  { select: { name: true } },
      },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.integration.findUnique({ where: { barbershopId }, select: { configJson: true, status: true } }),
  ]);

  // Build serialized appointment list
  const serialized: AgendaAppointment[] = appointments.map((a) => ({
    id:           a.id,
    trinksId:     a.trinksId,
    customerName: a.customer?.name ?? "Cliente",
    serviceName:  a.service?.name ?? null,
    scheduledAt:  a.scheduledAt.toISOString(),
    durationMin:  a.durationMin,
    status:       a.status,
    price:        a.price ? Number(a.price) : null,
    profissional: a.barberId ?? null,
    notes:        a.notes,
  }));

  // Compute KPIs server-side
  const active    = appointments.filter((a) => !["CANCELLED", "NO_SHOW"].includes(a.status));
  const kpis: AgendaKPIs = {
    revenueCompleted: appointments
      .filter((a) => a.status === "COMPLETED")
      .reduce((s, a) => s + Number(a.price ?? 0), 0),
    revenueProjected: appointments
      .filter((a) => ["SCHEDULED", "CONFIRMED", "IN_PROGRESS"].includes(a.status))
      .reduce((s, a) => s + Number(a.price ?? 0), 0),
    completedCount: appointments.filter((a) => a.status === "COMPLETED").length,
    cancelledCount: appointments.filter((a) => a.status === "CANCELLED").length,
    noShowCount:    appointments.filter((a) => a.status === "NO_SHOW").length,
    occupancyRate:  Math.min(active.length / TOTAL_SLOTS, 1),
    freeSlots:      Math.max(TOTAL_SLOTS - active.length, 0),
    totalSlots:     TOTAL_SLOTS,
  };

  const hasTrinks = !!integration?.configJson && integration.status === "ACTIVE";
  const dateLabel = format(now, "EEEE, dd 'de' MMMM");

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
          kpis={kpis}
          date={dateLabel}
          hasTrinks={hasTrinks}
        />
      </div>
    </div>
  );
}
