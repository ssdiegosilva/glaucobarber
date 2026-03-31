import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.barbershopId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const suggestion = await prisma.suggestion.findFirst({
    where: { id, barbershopId: session.user.barbershopId },
  });

  if (!suggestion) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.suggestion.update({
    where: { id },
    data:  { status: "APPROVED", actionTakenAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      barbershopId: session.user.barbershopId,
      userId:       session.user.id,
      action:       "suggestion.approved",
      entity:       "Suggestion",
      entityId:     id,
    },
  });

  return NextResponse.json({ ok: true });
}
