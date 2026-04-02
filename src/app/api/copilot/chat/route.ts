import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { buildCopilotContext, getAIProvider } from "@/lib/ai/provider";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { message, threadId } = await req.json();
  if (!message?.trim()) {
    return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
  }

  const barbershopId = session.user.barbershopId!;
  const userId = session.user.id;

  let thread = threadId
    ? await prisma.copilotThread.findUnique({ where: { id: threadId } })
    : null;

  if (thread && thread.barbershopId !== barbershopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!thread) {
    thread = await prisma.copilotThread.create({
      data: {
        barbershopId,
        title: message.slice(0, 60),
        createdBy: userId,
      },
    });
  }

  await prisma.copilotMessage.create({
    data: {
      threadId: thread.id,
      role: "USER",
      content: message,
    },
  });

  const context = await buildCopilotContext(barbershopId);
  const provider = getAIProvider();
  const reply = await provider.generateCopilotResponse(context, message);

  const assistantMsg = await prisma.copilotMessage.create({
    data: {
      threadId: thread.id,
      role: "ASSISTANT",
      content: reply.answer,
      actionsJson: reply.actions.length
        ? (reply.actions as unknown as Prisma.InputJsonValue)
        : undefined,
    },
  });

  // Dismiss old DRAFT actions before creating fresh ones — keeps panel clean
  if (reply.actions.length > 0) {
    await prisma.action.updateMany({
      where: { barbershopId, status: "DRAFT" },
      data: { status: "DISMISSED" },
    });
  }

  const createdActions = await Promise.all(
    reply.actions.map((a) =>
      prisma.action.create({
        data: {
          barbershopId,
          suggestionId: null,
          title: a.title,
          description: a.description ?? null,
          type: a.type ?? "general",
          payload: a.payload ? (a.payload as Prisma.InputJsonValue) : Prisma.JsonNull,
          status: "DRAFT",
          source: "ai",
          createdBy: userId,
        },
      })
    )
  );

  await prisma.copilotThread.update({
    where: { id: thread.id },
    data: { lastMessageAt: new Date() },
  });

  const messages = await prisma.copilotMessage.findMany({
    where: { threadId: thread.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    threadId: thread.id,
    messages,
    actionsDraft: createdActions,
    assistantMessageId: assistantMsg.id,
  });
}
