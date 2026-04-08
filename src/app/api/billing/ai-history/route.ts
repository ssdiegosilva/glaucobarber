import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 5;

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.barbershopId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const skip = Math.max(0, parseInt(searchParams.get("skip") ?? "0", 10));

  const rows = await prisma.aiCallLog.findMany({
    where:   { barbershopId: session.user.barbershopId },
    orderBy: { createdAt: "desc" },
    skip,
    take:    PAGE_SIZE + 1,
    select:  { id: true, feature: true, label: true, credits: true, source: true, createdAt: true },
  });

  const hasMore = rows.length > PAGE_SIZE;
  const logs    = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  return NextResponse.json({ logs, hasMore });
}
