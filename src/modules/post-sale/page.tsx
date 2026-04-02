import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { prisma } from "@/lib/prisma";
import { PostSaleClient } from "./components/PostSaleClient";
import type { CustomerSummary } from "./types";
import type { ReviewItem } from "./components/PostSaleClient";
import { subDays } from "date-fns";

export default async function PostSalePage() {
  const session = await auth();
  if (!session?.user?.barbershopId) redirect("/login");

  const barbershopId = session.user.barbershopId;
  const now          = new Date();
  const since48h     = subDays(now, 2);
  const since60d     = subDays(now, 60);

  const [
    emRisco,
    inativos,
    recentes,
    reativados,
    avalPendentes,
    customers,
    reviewRows,
  ] = await Promise.all([
    prisma.customer.count({ where: { barbershopId, postSaleStatus: "EM_RISCO" } }),
    prisma.customer.count({ where: { barbershopId, postSaleStatus: "INATIVO" } }),
    prisma.customer.count({ where: { barbershopId, postSaleStatus: "RECENTE", lastCompletedAppointmentAt: { gte: since48h } } }),
    prisma.customer.count({ where: { barbershopId, postSaleStatus: "REATIVADO", reactivatedAt: { gte: since60d } } }),
    prisma.customerReview.count({
      where: { barbershopId, requestStatus: "pendente", appointment: { completedAt: { gte: since48h } }, customer: { reviewOptOut: false } },
    }),

    // All customers with a post-sale status (excludes new/never-visited)
    prisma.customer.findMany({
      where: { barbershopId, postSaleStatus: { not: null } },
      select: {
        id:                         true,
        name:                       true,
        phone:                      true,
        postSaleStatus:             true,
        lastCompletedAppointmentAt: true,
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
            service:     { select: { name: true } },
            barberId:    true,
          },
          orderBy: { completedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { lastCompletedAppointmentAt: "asc" },
      take: 200,
    }),

    // Pending Google review requests (48h)
    prisma.customerReview.findMany({
      where: { barbershopId, requestStatus: "pendente", appointment: { completedAt: { gte: since48h } }, customer: { reviewOptOut: false } },
      select: {
        id:            true,
        requestStatus: true,
        customerId:    true,
        appointmentId: true,
        appointment:   { select: { completedAt: true, service: { select: { name: true } } } },
        customer:      { select: { name: true, phone: true } },
      },
      orderBy: { appointment: { completedAt: "desc" } },
      take: 50,
    }),
  ]);

  // Serialize customers
  const serializedCustomers: CustomerSummary[] = customers.map((c) => ({
    id:               c.id,
    name:             c.name,
    phone:            c.phone ?? null,
    lastVisitAt:      c.lastCompletedAppointmentAt?.toISOString() ?? null,
    nextAppointmentAt: null,
    postSaleStatus:   c.postSaleStatus ?? ("RECENTE" as any),
    churnReason:      c.churnReason ?? null,
    serviceName:      c.appointments[0]?.service?.name ?? null,
    ticketMedio:      c.totalSpent && c.totalVisits ? Number(c.totalSpent) / c.totalVisits : undefined,
    frequencia:       c.totalVisits ?? undefined,
  }));

  // Serialize reviews
  const serializedReviews: ReviewItem[] = reviewRows.map((r) => ({
    id:            r.id,
    customerId:    r.customerId,
    appointmentId: r.appointmentId,
    customerName:  r.customer.name,
    customerPhone: r.customer.phone,
    completedAt:   r.appointment.completedAt?.toISOString() ?? null,
    serviceName:   r.appointment.service?.name ?? null,
    requestStatus: r.requestStatus,
  }));

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Pós-venda"
        subtitle="Retenção, reativação e avaliações Google"
        userName={session.user.name}
      />
      <div className="p-6">
        <PostSaleClient
          summary={{ emRisco, avalPendentes, recentes, inativos, reativados }}
          customers={serializedCustomers}
          reviews={serializedReviews}
        />
      </div>
    </div>
  );
}
