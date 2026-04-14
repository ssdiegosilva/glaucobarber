import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const shop = await prisma.barbershop.findUnique({
    where: { id },
    include: {
      subscription: true,
      memberships: { include: { user: { select: { id: true, name: true, email: true } } } },
      _count: { select: { customers: true, appointments: true, billingEvents: true } },
    },
  });

  if (!shop) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [aiUsages, billingThisMonth, recentLogs] = await Promise.all([
    prisma.aiUsageMonth.findMany({ where: { barbershopId: id }, orderBy: { yearMonth: "desc" }, take: 6 }),
    prisma.billingEvent.aggregate({ where: { barbershopId: id, yearMonth }, _sum: { amountCents: true }, _count: { _all: true } }),
    prisma.auditLog.findMany({ where: { barbershopId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  return NextResponse.json({
    ...shop,
    aiUsages,
    billingThisMonth: {
      amountCents: billingThisMonth._sum.amountCents ?? 0,
      count: billingThisMonth._count._all,
    },
    recentLogs,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.segmentId !== undefined) data.segmentId = body.segmentId ?? null;
  if (body.name      !== undefined) data.name      = body.name;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const shop = await prisma.barbershop.update({ where: { id }, data, select: { id: true, segmentId: true } });
  return NextResponse.json(shop);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const shop = await prisma.barbershop.findUnique({ where: { id }, select: { id: true } });
  if (!shop) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.barbershop.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
