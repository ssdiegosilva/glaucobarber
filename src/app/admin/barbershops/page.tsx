import { prisma } from "@/lib/prisma";
import { BarbershopsClient } from "./barbershops-client";

export default async function AdminBarbershopsPage() {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const shops = await prisma.barbershop.findMany({
    where: { slug: { not: "__platform_admin__" } },
    include: {
      subscription: true,
      _count: { select: { customers: true, appointments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const shopIds = shops.map((s) => s.id);
  const aiUsages = await prisma.aiUsageMonth.findMany({
    where: { barbershopId: { in: shopIds }, yearMonth: { in: [yearMonth, "trial"] } },
  });
  const aiMap = Object.fromEntries(aiUsages.map((u) => [u.barbershopId, u.usageCount]));

  const data = shops.map((s) => ({
    id:           s.id,
    name:         s.name,
    slug:         s.slug,
    email:        s.email ?? "",
    city:         s.city  ?? "",
    createdAt:    s.createdAt.toISOString(),
    customers:    s._count.customers,
    appointments: s._count.appointments,
    aiUsed:       aiMap[s.id] ?? 0,
    planTier:     s.subscription?.planTier ?? "FREE",
    subStatus:    s.subscription?.status  ?? "ACTIVE",
    trialEndsAt:  s.subscription?.trialEndsAt?.toISOString() ?? null,
    creditBalance: s.subscription?.aiCreditBalance ?? 0,
    stripeCustomerId: s.stripeCustomerId ?? null,
  }));

  return <BarbershopsClient data={data} />;
}
