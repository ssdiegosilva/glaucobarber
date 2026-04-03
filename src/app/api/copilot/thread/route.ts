import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const threadId = req.nextUrl.searchParams.get("threadId");
  if (!threadId) return NextResponse.json({ error: "threadId is required" }, { status: 400 });

  const thread = await prisma.copilotThread.findUnique({ where: { id: threadId } });
  if (!thread || thread.barbershopId !== session.user.barbershopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [messages, actions] = await Promise.all([
    prisma.copilotMessage.findMany({ where: { threadId }, orderBy: { createdAt: "asc" } }),
    prisma.action.findMany({
      where: { barbershopId: session.user.barbershopId, status: "DRAFT" },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return NextResponse.json({ messages, actions });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const threadId = req.nextUrl.searchParams.get("threadId");
  if (!threadId) return NextResponse.json({ error: "threadId is required" }, { status: 400 });

  const thread = await prisma.copilotThread.findUnique({ where: { id: threadId } });
  if (!thread || thread.barbershopId !== session.user.barbershopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.copilotThread.delete({ where: { id: threadId } });
  return NextResponse.json({ ok: true });
}
