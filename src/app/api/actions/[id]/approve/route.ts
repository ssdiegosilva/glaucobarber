import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.barbershopId || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const action = await prisma.action.findUnique({ where: { id: params.id } });
  if (!action || action.barbershopId !== session.user.barbershopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.action.update({
    where: { id: params.id },
    data: { status: "APPROVED", approvedBy: session.user.id },
  });

  await prisma.auditLog.create({
    data: {
      barbershopId: action.barbershopId,
      userId: session.user.id,
      action: "action.approved",
      entity: "Action",
      entityId: action.id,
    },
  });

  return NextResponse.json({ ok: true });
}
