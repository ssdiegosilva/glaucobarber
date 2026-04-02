import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { WhatsappClient } from "./whatsapp-client";
import { startOfDay, endOfDay, subDays } from "date-fns";

export default async function WhatsappPage() {
  const session = await auth();
  if (!session?.user?.barbershopId) redirect("/onboarding");

  const barbershopId = session.user.barbershopId;
  const now = new Date();

  const [todayMessages, queueMessages, historyMessages] = await Promise.all([
    prisma.whatsappMessage.findMany({
      where: { barbershopId, createdAt: { gte: startOfDay(now), lte: endOfDay(now) } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.whatsappMessage.findMany({
      where: { barbershopId, status: "QUEUED" },
      orderBy: { createdAt: "asc" },
    }),
    prisma.whatsappMessage.findMany({
      where: { barbershopId, status: "SENT", sentAt: { gte: subDays(now, 30) } },
      orderBy: { sentAt: "desc" },
      take: 200,
    }),
  ]);

  const serialize = (m: typeof todayMessages[0]) => ({
    id:          m.id,
    customerName: m.customerName,
    phone:       m.phone,
    message:     m.message,
    type:        m.type,
    status:      m.status,
    actionId:    m.actionId,
    sentAt:      m.sentAt?.toISOString() ?? null,
    createdAt:   m.createdAt.toISOString(),
  });

  return (
    <div className="flex flex-col h-full">
      <Header
        title="WhatsApp"
        subtitle="Gestão de comunicações"
        userName={session.user.name}
      />
      <WhatsappClient
        todayMessages={todayMessages.map(serialize)}
        queueMessages={queueMessages.map(serialize)}
        historyMessages={historyMessages.map(serialize)}
      />
    </div>
  );
}
