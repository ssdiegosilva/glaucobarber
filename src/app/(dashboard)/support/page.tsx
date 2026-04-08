import { requireBarbershop } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { SupportClient } from "./support-client";

export default async function SupportPage() {
  const session = await requireBarbershop();
  const { barbershopId, id: userId } = session.user;

  const messages = await prisma.supportMessage.findMany({
    where:   { barbershopId, userId },
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

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Suporte"
        subtitle="Envie uma mensagem para o administrador da plataforma"
        userName={session.user.name}
      />
      <SupportClient
        initialMessages={messages.map((m) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
          repliedAt: m.repliedAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
