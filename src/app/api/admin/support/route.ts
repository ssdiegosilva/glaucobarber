import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const statusFilter    = searchParams.get("status") ?? "ALL";
  const barbershopFilter = searchParams.get("barbershopId") ?? undefined;

  const where: Record<string, unknown> = {};
  if (statusFilter !== "ALL") where.status = statusFilter;
  if (barbershopFilter)       where.barbershopId = barbershopFilter;

  const [messages, unreadCount] = await Promise.all([
    prisma.supportMessage.findMany({
      where,
      orderBy: [{ readByAdmin: "asc" }, { createdAt: "asc" }],
      include: {
        barbershop: { select: { id: true, name: true } },
        user:       { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.supportMessage.count({ where: { readByAdmin: false } }),
  ]);

  return NextResponse.json({
    messages: messages.map((m) => ({
      id:          m.id,
      body:        m.body,
      adminReply:  m.adminReply,
      status:      m.status,
      readByAdmin: m.readByAdmin,
      createdAt:   m.createdAt.toISOString(),
      repliedAt:   m.repliedAt?.toISOString() ?? null,
      barbershop:  m.barbershop,
      user:        { id: m.user.id, name: m.user.name, email: m.user.email },
    })),
    unreadCount,
  });
}
