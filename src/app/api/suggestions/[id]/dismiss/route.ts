import { NextRequest, NextResponse, type RouteHandlerContext } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: NextRequest, { params }: RouteHandlerContext<{ id: string }>) {
  const session = await auth();
  if (!session?.user?.barbershopId || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const suggestion = await prisma.suggestion.findUnique({ where: { id: params.id } });
  if (!suggestion || suggestion.barbershopId !== session.user.barbershopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.suggestion.update({ where: { id: params.id }, data: { status: "DISMISSED" } });

  await prisma.auditLog.create({
    data: {
      barbershopId: suggestion.barbershopId,
      userId: session.user.id,
      action: "suggestion.dismissed",
      entity: "Suggestion",
      entityId: suggestion.id,
    },
  });

  return NextResponse.json({ ok: true });
}
