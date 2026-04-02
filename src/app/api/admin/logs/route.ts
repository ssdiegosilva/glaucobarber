import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const barbershopId = searchParams.get("barbershopId") ?? undefined;
  const action       = searchParams.get("action")       ?? undefined;
  const page         = Number(searchParams.get("page") ?? "1");
  const limit        = 50;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        ...(barbershopId ? { barbershopId } : {}),
        ...(action       ? { action: { contains: action, mode: "insensitive" } } : {}),
      },
      include: {
        barbershop: { select: { name: true } },
        user:       { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip:  (page - 1) * limit,
      take:  limit,
    }),
    prisma.auditLog.count({
      where: {
        ...(barbershopId ? { barbershopId } : {}),
        ...(action       ? { action: { contains: action, mode: "insensitive" } } : {}),
      },
    }),
  ]);

  return NextResponse.json({ logs, total, page, pages: Math.ceil(total / limit) });
}
