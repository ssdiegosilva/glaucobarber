import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { prisma } from "@/lib/prisma";
import { PostSaleClient } from "./components/PostSaleClient";
import type { CustomerSummary, PostSaleFilterConfig, CustomFilter } from "./types";
import { subDays } from "date-fns";
import { canAccess } from "@/lib/access";
import { getPlan } from "@/lib/billing";
import { UpgradeWall } from "@/components/billing/UpgradeWall";

export default async function PostSalePage() {
  const session = await auth();
  if (!session?.user?.barbershopId) redirect("/login");

  const barbershopId = session.user.barbershopId;

  const { effectiveTier } = await getPlan(barbershopId);
  const allowed = await canAccess(barbershopId, effectiveTier, "post-sale");
  if (!allowed) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Pós-venda" subtitle="Reativação e fidelização de clientes" userName={session.user.name ?? ""} />
        <UpgradeWall
          feature="Pós-venda"
          requiredPlan="PRO"
          description="Identifique clientes em risco, inativos e recentes. Envie mensagens automáticas para reativar e fidelizar."
        />
      </div>
    );
  }
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
            serviceId:   true,
            service:     { select: { id: true, name: true } },
            barberId:    true,
            items:       { select: { serviceId: true, productId: true, name: true }, take: 5 },
          },
          where:   { status: "COMPLETED" },
          orderBy: { scheduledAt: "desc" },
          take: 10,
        },
        visits: {
          select: {
            visitedAt: true,
            items: {
              select: { productId: true, name: true },
              where: { productId: { not: null } },
            },
          },
          orderBy: { visitedAt: "desc" },
          take: 10,
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
      select: { googleReviewUrl: true, postSaleFilters: true },
    }),
  ]);

  // Parse post-sale filter config
  const DEFAULT_FILTER_CONFIG: PostSaleFilterConfig = {
    defaults: { emRisco: true, recentes: true, inativos: true, reativados: true },
    custom: [],
    visible: ["emRisco", "recentes", "inativos", "reativados"],
  };
  let filterConfig: PostSaleFilterConfig = DEFAULT_FILTER_CONFIG;
  try {
    const raw = JSON.parse(barbershop?.postSaleFilters ?? "[]");
    if (raw && typeof raw === "object" && !Array.isArray(raw) && raw.defaults) {
      filterConfig = {
        ...raw,
        custom: (raw.custom ?? []).map((c: CustomFilter & { type?: string }) => ({
          ...c,
          type: c.type ?? "service",
        })),
      };
    }
  } catch { /* keep default */ }

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
      recentAppointments: c.appointments.flatMap((a): { serviceId: string | null; serviceName: string | null; completedAt: string }[] => {
        const date = (a.completedAt ?? a.scheduledAt)?.toISOString() ?? "";
        const mainServiceId = a.serviceId ?? a.service?.id ?? null;
        if (mainServiceId) {
          return [{ serviceId: mainServiceId, serviceName: a.service?.name ?? null, completedAt: date }];
        }
        if (a.items && a.items.length > 0) {
          return a.items
            .filter((item) => item.serviceId)
            .map((item) => ({ serviceId: item.serviceId, serviceName: item.name, completedAt: date }));
        }
        return [{ serviceId: null, serviceName: null, completedAt: date }];
      }),
      recentProductPurchases: [
        // Produtos vendidos em visitas (balcão)
        ...(c.visits ?? []).flatMap((v) =>
          v.items
            .filter((item) => item.productId)
            .map((item) => ({
              productId: item.productId,
              productName: item.name,
              purchasedAt: v.visitedAt.toISOString(),
            }))
        ),
        // Produtos vendidos durante atendimentos
        ...c.appointments.flatMap((a) =>
          (a.items ?? [])
            .filter((item) => item.productId)
            .map((item) => ({
              productId: item.productId,
              productName: item.name,
              purchasedAt: (a.completedAt ?? a.scheduledAt)?.toISOString() ?? "",
            }))
        ),
      ],
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
          filterConfig={filterConfig}
        />
      </div>
    </div>
  );
}
