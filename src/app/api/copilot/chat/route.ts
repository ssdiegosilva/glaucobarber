import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

  let thread = threadId
    ? await prisma.copilotThread.findUnique({ where: { id: threadId } })
    : null;

  if (thread && thread.barbershopId !== session.user.barbershopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!thread) {
    thread = await prisma.copilotThread.create({
      data: {
        barbershopId: session.user.barbershopId,
        title: message.slice(0, 60),
        createdBy: session.user.id,
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

  const context = await buildCopilotContext(session.user.barbershopId);
  const provider = getAIProvider();
  const reply = await provider.generateCopilotResponse(context, message);

  const assistantMsg = await prisma.copilotMessage.create({
    data: {
      threadId: thread.id,
      role: "ASSISTANT",
      content: reply.answer,
      actionsJson: reply.actions.length ? reply.actions : undefined,
    },
  });

  const createdActions = await Promise.all(
    reply.actions.map((a) =>
      prisma.action.create({
        data: {
          barbershopId: session.user.barbershopId,
          title: a.title,
          description: a.description,
          type: a.type ?? "general",
          payload: a.payload ?? null,
          status: "DRAFT",
          source: "ai",
          createdBy: session.user.id,
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
