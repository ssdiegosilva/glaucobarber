import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.barbershopId || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const messages = await prisma.supportMessage.findMany({
    where: {
      barbershopId: session.user.barbershopId,
      userId:       session.user.id,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id:         true,
      body:       true,
      adminReply: true,
      status:     true,
      createdAt:  true,
      repliedAt:  true,
    },
  });

  return NextResponse.json({
    messages: messages.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
      repliedAt: m.repliedAt?.toISOString() ?? null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { body } = await req.json();
  if (!body || typeof body !== "string" || body.trim().length === 0) {
    return NextResponse.json({ error: "Mensagem não pode ser vazia" }, { status: 400 });
  }
  if (body.length > 2000) {
    return NextResponse.json({ error: "Mensagem muito longa (máx. 2000 caracteres)" }, { status: 400 });
  }

  const message = await prisma.supportMessage.create({
    data: {
      barbershopId: session.user.barbershopId,
      userId:       session.user.id,
      body:         body.trim(),
    },
    select: { id: true, createdAt: true },
  });

  return NextResponse.json({ id: message.id, createdAt: message.createdAt.toISOString() }, { status: 201 });
}
