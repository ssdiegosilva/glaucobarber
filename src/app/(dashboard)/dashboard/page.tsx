import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { DashboardClient } from "./dashboard-client";
import { startOfDay, endOfDay, format, getDay } from "date-fns";

const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.barbershopId) redirect("/onboarding");

  const barbershopId = session.user.barbershopId;
  const now          = new Date();
  const start        = startOfDay(now);
  const end          = endOfDay(now);

  const [barbershop, todayAppointments, pendingSuggestions, recentCampaign, goal, inactiveCount] =
    await Promise.all([
      prisma.barbershop.findUnique({
        where:  { id: barbershopId },
        select: { name: true, trinksConfigured: true },
      }),

      prisma.appointment.findMany({
        where:   { barbershopId, scheduledAt: { gte: start, lte: end } },
        orderBy: { scheduledAt: "asc" },
        include: { customer: { select: { name: true } }, service: { select: { name: true, price: true } } },
      }),

      prisma.suggestion.findMany({
        where:   { barbershopId, status: "PENDING" },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),

      prisma.campaign.findFirst({
        where:   { barbershopId, status: "APPROVED" },
        orderBy: { createdAt: "desc" },
      }),

      prisma.goal.findFirst({
        where: { barbershopId, month: now.getMonth() + 1, year: now.getFullYear() },
      }),

      prisma.customer.count({
        where: {
          barbershopId,
          status:      "ACTIVE",
          lastVisitAt: { lt: new Date(Date.now() - 30 * 86400_000) },
        },
      }),
    ]);

  const TOTAL_SLOTS   = 20;
  const bookedSlots   = todayAppointments.filter((a) => a.status !== "CANCELLED" && a.status !== "NO_SHOW").length;
  const completedRev  = todayAppointments
    .filter((a) => a.status === "COMPLETED")
    .reduce((s, a) => s + Number(a.service?.price ?? a.price ?? 0), 0);
  const projectedRev  = todayAppointments
    .filter((a) => a.status !== "CANCELLED" && a.status !== "NO_SHOW")
    .reduce((s, a) => s + Number(a.service?.price ?? a.price ?? 0), 0);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Dashboard"
        subtitle={`${DAY_NAMES[getDay(now)]}, ${format(now, "d 'de' MMMM")}`}
        userName={session.user.name}
      />

      <DashboardClient
        barbershopName={barbershop?.name ?? ""}
        trinksConfigured={barbershop?.trinksConfigured ?? false}
        stats={{
          totalSlots:   TOTAL_SLOTS,
          bookedSlots,
          freeSlots:    TOTAL_SLOTS - bookedSlots,
          occupancyRate: bookedSlots / TOTAL_SLOTS,
          completedRevenue: completedRev,
          projectedRevenue: projectedRev,
          revenueGoal:  goal?.revenueTarget ? Number(goal.revenueTarget) : null,
          inactiveClients: inactiveCount,
        }}
        appointments={todayAppointments.map((a) => ({
          id:          a.id,
          customerName: a.customer?.name ?? "—",
          serviceName:  a.service?.name ?? "—",
          scheduledAt:  a.scheduledAt.toISOString(),
          status:       a.status,
          price:        Number(a.service?.price ?? a.price ?? 0),
        }))}
        suggestions={pendingSuggestions.map((s) => ({
          id:      s.id,
          type:    s.type,
          title:   s.title,
          content: s.content,
          reason:  s.reason,
        }))}
        campaign={recentCampaign ? {
          id:        recentCampaign.id,
          title:     recentCampaign.title,
          text:      recentCampaign.text,
          channel:   recentCampaign.channel ?? "",
        } : null}
      />
    </div>
  );
}
