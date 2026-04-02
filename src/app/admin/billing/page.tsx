import { prisma } from "@/lib/prisma";
import { BillingAdminClient } from "./billing-admin-client";

export default async function AdminBillingPage() {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [summary, recentEvents] = await Promise.all([
    prisma.billingEvent.groupBy({
      by:    ["yearMonth"],
      _sum:  { amountCents: true },
      _count: { _all: true },
      orderBy: { yearMonth: "desc" },
      take: 12,
    }),
    prisma.billingEvent.findMany({
      where:   { yearMonth },
      include: { barbershop: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <BillingAdminClient
      summary={summary.map((s) => ({
        yearMonth:   s.yearMonth,
        totalCents:  s._sum.amountCents ?? 0,
        count:       s._count._all,
      }))}
      events={recentEvents.map((e) => ({
        id:              e.id,
        barbershopName:  e.barbershop.name,
        yearMonth:       e.yearMonth,
        amountCents:     e.amountCents,
        invoicedAt:      e.invoicedAt?.toISOString() ?? null,
        createdAt:       e.createdAt.toISOString(),
      }))}
      currentYearMonth={yearMonth}
    />
  );
}
