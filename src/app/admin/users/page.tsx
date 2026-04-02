import { prisma } from "@/lib/prisma";
import { UsersClient } from "./users-client";

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    include: {
      memberships: { include: { barbershop: { select: { id: true, name: true, slug: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const data = users.map((u) => ({
    id:        u.id,
    name:      u.name ?? "",
    email:     u.email,
    createdAt: u.createdAt.toISOString(),
    memberships: u.memberships.map((m) => ({
      id:            m.id,
      role:          m.role,
      active:        m.active,
      barbershopId:  m.barbershopId,
      barbershopName: m.barbershop.name,
      barbershopSlug: m.barbershop.slug,
    })),
  }));

  return <UsersClient data={data} />;
}
