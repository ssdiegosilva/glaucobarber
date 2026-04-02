import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const defaultYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const yearMonth = searchParams.get("yearMonth") ?? defaultYm;

  const [events, summary] = await Promise.all([
    prisma.billingEvent.findMany({
      where:   { yearMonth },
      include: { barbershop: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take:    200,
    }),
    prisma.billingEvent.groupBy({
      by:    ["barbershopId"],
      where: { yearMonth },
      _sum:  { amountCents: true },
      _count: { _all: true },
    }),
  ]);

  return NextResponse.json({ events, summary, yearMonth });
}
