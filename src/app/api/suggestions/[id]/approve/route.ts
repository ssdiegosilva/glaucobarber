import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.barbershopId || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const suggestion = await prisma.suggestion.findUnique({ where: { id: params.id } });
  if (!suggestion || suggestion.barbershopId !== session.user.barbershopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.suggestion.update({ where: { id: params.id }, data: { status: "APPROVED" } });

  const action = await prisma.action.create({
    data: {
      barbershopId: suggestion.barbershopId,
      suggestionId: suggestion.id,
      title: suggestion.title,
      description: suggestion.content,
      type: suggestion.type,
      status: "APPROVED",
      source: "ai",
      createdBy: session.user.id,
      approvedBy: session.user.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      barbershopId: suggestion.barbershopId,
      userId: session.user.id,
      action: "suggestion.approved",
      entity: "Suggestion",
      entityId: suggestion.id,
      metadata: JSON.stringify({ actionId: action.id }),
    },
  });

  return NextResponse.json({ ok: true, actionId: action.id });
}
