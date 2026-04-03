import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { WhatsappClient } from "./whatsapp-client";
import { startOfDay } from "date-fns";

export default async function WhatsappPage() {
  const session = await auth();
  if (!session?.user?.barbershopId) redirect("/onboarding");

  const barbershopId = session.user.barbershopId;
  const now     = new Date();
  const todayStart = startOfDay(now);
  const ago10  = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

  const [sentToday, queueMessages, failedToday, historyMessages] = await Promise.all([
    // Enviadas hoje
    prisma.whatsappMessage.findMany({
      where: { barbershopId, status: "SENT", sentAt: { gte: todayStart } },
      orderBy: { sentAt: "desc" },
    }),
    // Na fila (queued + scheduled)
    prisma.whatsappMessage.findMany({
      where: { barbershopId, status: "QUEUED" },
      orderBy: { createdAt: "asc" },
    }),
    // Com falha hoje
    prisma.whatsappMessage.findMany({
      where: { barbershopId, status: "FAILED", createdAt: { gte: todayStart } },
      orderBy: { createdAt: "desc" },
    }),
    // Histórico: SENT dos últimos 10 dias (excluindo hoje)
    prisma.whatsappMessage.findMany({
      where: { barbershopId, status: "SENT", sentAt: { gte: ago10, lt: todayStart } },
      orderBy: { sentAt: "desc" },
      take: 300,
    }),
  ]);

  const serialize = (m: typeof sentToday[0]) => ({
    id:            m.id,
    customerId:    m.customerId ?? null,
    customerName:  m.customerName,
    phone:         m.phone,
    message:       m.message,
    type:          m.type,
    status:        m.status,
    actionId:      m.actionId,
    sentAt:        m.sentAt?.toISOString() ?? null,
    scheduledFor:  (m as any).scheduledFor ? new Date((m as any).scheduledFor).toISOString() : null,
    createdAt:     m.createdAt.toISOString(),
    metaMessageId: (m as any).metaMessageId ?? null,
    errorMessage:  (m as any).errorMessage  ?? null,
  });

  return (
    <div>
      <Header
        title="WhatsApp"
        subtitle="Gestão de comunicações"
        userName={session.user.name}
      />
      <WhatsappClient
        sentToday={sentToday.map(serialize)}
        queueMessages={queueMessages.map(serialize)}
        failedToday={failedToday.map(serialize)}
        historyMessages={historyMessages.map(serialize)}
      />
    </div>
  );
}
