import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const statusParam = req.nextUrl.searchParams.get("status") ?? undefined;
  const allowedStatuses = ["DRAFT", "APPROVED", "EDITED", "DISMISSED", "EXECUTED"] as const;
  const status = allowedStatuses.includes(statusParam as any) ? statusParam : undefined;

  const actions = await prisma.action.findMany({
    where: {
      barbershopId: session.user.barbershopId,
      ...(status ? { status: status as any } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ actions });
}
