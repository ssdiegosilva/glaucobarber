import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.barbershopId || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const action = await prisma.action.findUnique({ where: { id: params.id } });
  if (!action || action.barbershopId !== session.user.barbershopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();

  await prisma.action.update({
    where: { id: params.id },
    data: {
      title: body.title ?? action.title,
      description: body.description ?? action.description,
      type: body.type ?? action.type,
      payload: body.payload ?? action.payload,
      status: "EDITED",
    },
  });

  await prisma.auditLog.create({
    data: {
      barbershopId: action.barbershopId,
      userId: session.user.id,
      action: "action.edited",
      entity: "Action",
      entityId: action.id,
    },
  });

  return NextResponse.json({ ok: true });
}
