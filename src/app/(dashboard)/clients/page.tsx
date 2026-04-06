import { requireBarbershop } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { ClientsClient } from "./clients-client";

const PAGE_SIZE = 100;

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; vip?: string; inactive?: string }>;
}) {
  const session = await requireBarbershop();

  const { page: pageParam, q, vip, inactive } = await searchParams;
  const vipFilter      = vip === "1";
  const inactiveFilter = inactive === "1";
  const page  = Math.max(1, parseInt(pageParam ?? "1"));
  const skip  = (page - 1) * PAGE_SIZE;
  const where = {
    barbershopId: session.user.barbershopId,
    deletedAt:    null,
    ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    ...(vipFilter      ? { status: "VIP"      as const } : {}),
    ...(inactiveFilter ? { status: "INACTIVE" as const } : {}),
  };

  const [customers, total, vipCount, inactiveCount] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: [{ status: "desc" }, { lastVisitAt: "desc" }],
      take:    PAGE_SIZE,
      skip,
      select: {
        id: true, name: true, phone: true, email: true, notes: true,
        status: true, postSaleStatus: true, doNotContact: true, tags: true,
        totalVisits: true, totalSpent: true, lastVisitAt: true,
      },
    }),
    prisma.customer.count({ where }),
    prisma.customer.count({ where: { barbershopId: session.user.barbershopId, deletedAt: null, status: "VIP" } }),
    prisma.customer.count({ where: { barbershopId: session.user.barbershopId, deletedAt: null, status: "INACTIVE" } }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Clientes"
        subtitle={`${total} clientes`}
        userName={session.user.name}
      />
      <div className="p-6">
        <ClientsClient
          key={`${vipFilter ? "vip" : inactiveFilter ? "inactive" : "all"}-${q ?? ""}-${page}`}
          customers={customers.map((c) => ({
            id:             c.id,
            name:           c.name,
            phone:          c.phone,
            email:          c.email,
            notes:          c.notes,
            status:         c.status,
            postSaleStatus: c.postSaleStatus,
            doNotContact:   c.doNotContact,
            tags:           c.tags,
            totalVisits:    c.totalVisits,
            totalSpent:     Number(c.totalSpent),
            lastVisitAt:    c.lastVisitAt?.toISOString() ?? null,
          }))}
          total={total}
          page={page}
          totalPages={totalPages}
          q={q}
          vipCount={vipCount}
          inactiveCount={inactiveCount}
          vipFilter={vipFilter}
          inactiveFilter={inactiveFilter}
        />
      </div>
    </div>
  );
}
