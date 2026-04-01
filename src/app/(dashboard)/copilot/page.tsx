import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import CopilotClient from "./copilot-client";

export default async function CopilotPage() {
  const session = await auth();
  if (!session?.user?.barbershopId) redirect("/onboarding");

  const threads = await prisma.copilotThread.findMany({
    where: { barbershopId: session.user.barbershopId },
    orderBy: { lastMessageAt: "desc" },
  });

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

  return (
    <div className="flex flex-col h-full">
      <Header title="CEO Copilot" subtitle="Pergunte qualquer coisa sobre o dia e aprove ações" userName={session.user.name} />
      <CopilotClient
        initialThreads={threads}
        initialMessages={messages}
        initialActions={actions}
        initialThreadId={activeThread?.id ?? null}
      />
    </div>
  );
}
