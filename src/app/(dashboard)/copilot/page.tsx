import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import CopilotClient from "./copilot-client";

export default async function CopilotPage() {
  const session = await auth();
  if (!session?.user?.barbershopId) redirect("/onboarding");

  // Auto-cleanup: remove threads older than 3 days
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  await prisma.copilotThread.deleteMany({
    where: { barbershopId: session.user.barbershopId, lastMessageAt: { lt: cutoff } },
  });

  const threads = await prisma.copilotThread.findMany({
    where: { barbershopId: session.user.barbershopId },
    orderBy: { lastMessageAt: "desc" },
    take: 5,
  });

  const threadDtos = threads.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    lastMessageAt: t.lastMessageAt.toISOString(),
  }));

  const activeThread = threads[0] ?? null;

  const [messages, actions] = activeThread
    ? await Promise.all([
        prisma.copilotMessage.findMany({
          where: { threadId: activeThread.id },
          orderBy: { createdAt: "asc" },
        }),
        prisma.action.findMany({
          where: { barbershopId: session.user.barbershopId, status: { in: ["DRAFT", "APPROVED", "EDITED"] } },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
      ])
    : [[], []];

  const messageDtos = messages.map((m) => ({
    id: m.id,
    threadId: m.threadId,
    role: m.role,
    content: m.content,
    actionsJson: m.actionsJson as any,
    createdAt: m.createdAt.toISOString(),
  }));

  const actionDtos = actions.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    type: a.type,
    status: a.status,
    payload: (a.payload ?? null) as Record<string, unknown> | null,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <div className="flex flex-col h-full">
      <Header title="CEO Copilot" subtitle="Pergunte qualquer coisa sobre o dia e aprove ações" userName={session.user.name} />
      <CopilotClient
        initialThreads={threadDtos}
        initialMessages={messageDtos}
        initialActions={actionDtos}
        initialThreadId={activeThread?.id ?? null}
      />
    </div>
  );
}
