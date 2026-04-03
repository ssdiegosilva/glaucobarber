import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { prisma } from "@/lib/prisma";
import { PostSaleClient } from "./components/PostSaleClient";
import type { CustomerSummary } from "./types";
import { subDays } from "date-fns";

export default async function PostSalePage() {
  const session = await auth();
  if (!session?.user?.barbershopId) redirect("/login");

  const barbershopId = session.user.barbershopId;
  const now     = new Date();
  const since14d = subDays(now, 14);
  const since60d = subDays(now, 60);

  const [
    emRisco,
    inativos,
    recentes,
    reativados,
    customers,
    recentReviews,
    recentWhatsapps,
    barbershop,
  ] = await Promise.all([
    prisma.customer.count({ where: { barbershopId, postSaleStatus: "EM_RISCO" } }),
    prisma.customer.count({ where: { barbershopId, postSaleStatus: "INATIVO" } }),
    prisma.customer.count({ where: { barbershopId, postSaleStatus: "RECENTE", lastCompletedAppointmentAt: { gte: since14d } } }),
    prisma.customer.count({ where: { barbershopId, postSaleStatus: "REATIVADO", reactivatedAt: { gte: since60d } } }),

    // All customers with a post-sale status
    prisma.customer.findMany({
      where: { barbershopId, postSaleStatus: { not: null } },
      select: {
        id:                         true,
        name:                       true,
        phone:                      true,
        postSaleStatus:             true,
        lastCompletedAppointmentAt: true,
        lastWhatsappSentAt:         true,
        churnReason:                true,
        doNotContact:               true,
        reactivatedAt:              true,
        totalVisits:                true,
        totalSpent:                 true,
        appointments: {
          select: {
            id:          true,
            completedAt: true,
            scheduledAt: true,
            status:      true,
            price:       true,
            service:     { select: { name: true } },
            barberId:    true,
          },
          where:   { status: "COMPLETED" },
          orderBy: { completedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { lastCompletedAppointmentAt: "asc" },
      take: 200,
    }),

    // Review status for appointments in the last 14 days
    prisma.customerReview.findMany({
      where: { barbershopId, appointment: { completedAt: { gte: since14d } } },
      select: { appointmentId: true, requestStatus: true },
    }),

    // WhatsApp messages sent since 14 days ago (to track which FUP types were done per customer)
    prisma.whatsappMessage.findMany({
      where: {
        barbershopId,
        status: { in: ["SENT", "QUEUED"] },
        createdAt: { gte: since14d },
        customerId: { not: null },
      },
      select: { customerId: true, type: true, createdAt: true },
    }),

    // Barbershop config for Google review URL
    prisma.barbershop.findUnique({
      where:  { id: barbershopId },
      select: { googleReviewUrl: true },
    }),
  ]);

  // Build lookup maps
  const reviewByAppt = new Map(recentReviews.map((r) => [r.appointmentId, r.requestStatus]));

  const whatsappsByCust: Record<string, { type: string; createdAt: Date }[]> = {};
  for (const m of recentWhatsapps) {
    if (!m.customerId) continue;
    if (!whatsappsByCust[m.customerId]) whatsappsByCust[m.customerId] = [];
    whatsappsByCust[m.customerId].push({ type: m.type, createdAt: m.createdAt });
  }

  const serializedCustomers: CustomerSummary[] = customers.map((c) => {
    const lastAppt   = c.appointments[0];
    const lastApptAt = c.lastCompletedAppointmentAt;

    // Review status for the latest appointment
    const reviewStatus = lastAppt ? (reviewByAppt.get(lastAppt.id) ?? null) : null;

    // WhatsApp types sent AFTER the last appointment
    const msgs = (whatsappsByCust[c.id] ?? []).filter(
      (m) => !lastApptAt || m.createdAt >= lastApptAt
    );
    const sentTypes = [...new Set(msgs.map((m) => m.type))];

    return {
      id:                         c.id,
      name:                       c.name,
      phone:                      c.phone ?? null,
      lastVisitAt:                c.lastCompletedAppointmentAt?.toISOString() ?? null,
      nextAppointmentAt:          null,
      postSaleStatus:             c.postSaleStatus ?? ("RECENTE" as any),
      churnReason:                c.churnReason ?? null,
      serviceName:                lastAppt?.service?.name ?? null,
      servicePrice:               lastAppt?.price ? Number(lastAppt.price) : null,
      ticketMedio:                c.totalSpent && c.totalVisits ? Number(c.totalSpent) / c.totalVisits : undefined,
      frequencia:                 c.totalVisits ?? undefined,
      lastWhatsappSentAt:         c.lastWhatsappSentAt?.toISOString() ?? null,
      lastCompletedAppointmentAt: c.lastCompletedAppointmentAt?.toISOString() ?? null,
      lastAppointmentId:          lastAppt?.id ?? null,
      reviewStatus,
      sentTypes,
    };
  });

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Pós-venda"
        subtitle="Retenção, reativação e avaliações Google"
        userName={session.user.name}
      />
      <div className="p-4 sm:p-6">
        <PostSaleClient
          summary={{ emRisco, recentes, inativos, reativados }}
          customers={serializedCustomers}
          googleReviewUrl={barbershop?.googleReviewUrl ?? null}
        />
      </div>
    </div>
  );
}
