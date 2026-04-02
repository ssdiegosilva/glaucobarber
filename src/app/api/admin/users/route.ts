import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    include: {
      memberships: {
        include: { barbershop: { select: { id: true, name: true, slug: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(users.map((u) => ({
    id:         u.id,
    name:       u.name,
    email:      u.email,
    createdAt:  u.createdAt,
    memberships: u.memberships.map((m) => ({
      id:          m.id,
      role:        m.role,
      active:      m.active,
      barbershop:  m.barbershop,
    })),
  })));
}
