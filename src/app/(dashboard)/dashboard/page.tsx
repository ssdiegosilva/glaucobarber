import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { DashboardClient } from "./dashboard-client";
import { getLiveDayStats } from "@/lib/integrations/trinks/live";
import { format, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";

const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.barbershopId) redirect("/onboarding");

  const barbershopId = session.user.barbershopId;
  const now          = new Date();

  // Fetch in parallel: live Trinks data + local DB data
  const [liveDay, barbershop, pendingSuggestions, recentCampaign, goal, inactiveCount] =
    await Promise.all([
      // Live from Trinks: today's agenda
      getLiveDayStats(barbershopId),

      prisma.barbershop.findUnique({
        where:  { id: barbershopId },
        select: { name: true, trinksConfigured: true },
      }),

      // Local DB: AI suggestions
      prisma.suggestion.findMany({
        where:   { barbershopId, status: "PENDING" },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),

      // Local DB: latest approved campaign
      prisma.campaign.findFirst({
        where:   { barbershopId, status: "APPROVED" },
        orderBy: { createdAt: "desc" },
      }),

      // Local DB: monthly goal
      prisma.goal.findFirst({
        where: { barbershopId, month: now.getMonth() + 1, year: now.getFullYear() },
      }),

      // Local DB: inactive clients count
      prisma.customer.count({
        where: {
          barbershopId,
          status:      "ACTIVE",
          lastVisitAt: { lt: new Date(Date.now() - 30 * 86400_000) },
        },
      }),
    ]);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Dashboard"
        subtitle={`${DAY_NAMES[getDay(now)]}, ${format(now, "d 'de' MMMM", { locale: ptBR })}`}
        userName={session.user.name}
      />

      <DashboardClient
        barbershopName={barbershop?.name ?? ""}
        trinksConfigured={barbershop?.trinksConfigured ?? false}
        liveError={liveDay.error}
        stats={{
          totalSlots:       liveDay.totalSlots,
          bookedSlots:      liveDay.bookedSlots,
          freeSlots:        liveDay.freeSlots,
          occupancyRate:    liveDay.occupancyRate,
          completedRevenue: liveDay.completedRevenue,
          projectedRevenue: liveDay.projectedRevenue,
          revenueGoal:      goal?.revenueTarget ? Number(goal.revenueTarget) : null,
          inactiveClients:  inactiveCount,
        }}
        appointments={liveDay.appointments.map((a) => ({
          id:           a.id,
          customerName: a.customerName,
          serviceName:  a.serviceName,
          scheduledAt:  a.scheduledAt.toISOString(),
          status:       a.status,
          statusLabel:  a.statusLabel,
          price:        a.price,
          profissional: a.profissional,
        }))}
        suggestions={pendingSuggestions.map((s) => ({
          id:      s.id,
          type:    s.type,
          title:   s.title,
          content: s.content,
          reason:  s.reason,
        }))}
        campaign={recentCampaign ? {
          id:      recentCampaign.id,
          title:   recentCampaign.title,
          text:    recentCampaign.text,
          channel: recentCampaign.channel ?? "",
        } : null}
      />
    </div>
  );
}
