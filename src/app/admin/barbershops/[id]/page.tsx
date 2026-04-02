import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BarbershopDetailClient } from "./barbershop-detail-client";

export default async function AdminBarbershopDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const shop = await prisma.barbershop.findUnique({
    where: { id },
    include: {
      subscription: true,
      memberships: { include: { user: { select: { id: true, name: true, email: true } } } },
      _count: { select: { customers: true, appointments: true } },
    },
  });

  if (!shop || shop.slug === "__platform_admin__") notFound();

  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [aiUsages, billingAgg] = await Promise.all([
    prisma.aiUsageMonth.findMany({ where: { barbershopId: id }, orderBy: { yearMonth: "desc" }, take: 6 }),
    prisma.billingEvent.aggregate({ where: { barbershopId: id, yearMonth }, _sum: { amountCents: true }, _count: { _all: true } }),
  ]);

  return (
    <BarbershopDetailClient
      shop={{
        id:          shop.id,
        name:        shop.name,
        slug:        shop.slug,
        email:       shop.email ?? "",
        city:        shop.city  ?? "",
        state:       shop.state ?? "",
        createdAt:   shop.createdAt.toISOString(),
        customers:   shop._count.customers,
        appointments: shop._count.appointments,
        stripeCustomerId: shop.stripeCustomerId ?? null,
        memberships: shop.memberships.map((m) => ({
          id: m.id, role: m.role, active: m.active,
          user: m.user,
        })),
      }}
      subscription={shop.subscription ? {
        planTier:          shop.subscription.planTier,
        status:            shop.subscription.status,
        currentPeriodEnd:  shop.subscription.currentPeriodEnd.toISOString(),
        trialEndsAt:       shop.subscription.trialEndsAt?.toISOString() ?? null,
        cancelAtPeriodEnd: shop.subscription.cancelAtPeriodEnd,
        aiCreditBalance:   shop.subscription.aiCreditBalance,
      } : null}
      aiUsages={aiUsages.map((u) => ({ yearMonth: u.yearMonth, usageCount: u.usageCount }))}
      billingThisMonth={{ amountCents: billingAgg._sum.amountCents ?? 0, count: billingAgg._count._all }}
    />
  );
}
