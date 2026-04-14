import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { OfertaDetalheClient } from "./oferta-detalhe-client";

export default async function OfertaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.barbershopId) redirect("/login");

  const { id } = await params;
  const barbershopId = session.user.barbershopId;

  const offer = await prisma.targetedOffer.findFirst({
    where: { id, barbershopId },
  });
  if (!offer) notFound();

  // First page of customers
  const [customers, total] = await Promise.all([
    prisma.targetedOfferCustomer.findMany({
      where: { targetedOfferId: id },
      orderBy: { createdAt: "asc" },
      take: 10,
    }),
    prisma.targetedOfferCustomer.count({ where: { targetedOfferId: id } }),
  ]);

  // Fetch WhatsApp statuses
  const msgIds = customers.map((c) => c.whatsappMsgId).filter(Boolean) as string[];
  const whatsappMsgs = msgIds.length > 0
    ? await prisma.whatsappMessage.findMany({
        where: { id: { in: msgIds } },
        select: { id: true, status: true, sentAt: true },
      })
    : [];

  const statusMap = Object.fromEntries(whatsappMsgs.map((m) => [m.id, m]));

  const enriched = customers.map((c: typeof customers[number]) => ({
    id: c.id,
    customerName: c.customerName,
    phone: c.phone,
    message: c.message,
    whatsappStatus: c.whatsappMsgId ? (statusMap[c.whatsappMsgId]?.status ?? null) : null,
    sentAt: c.whatsappMsgId && statusMap[c.whatsappMsgId]?.sentAt
      ? statusMap[c.whatsappMsgId].sentAt!.toISOString()
      : null,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <div className="flex flex-col h-full">
      <Header
        title={offer.title}
        subtitle={`${offer.customersCount} cliente${offer.customersCount !== 1 ? "s" : ""} atingido${offer.customersCount !== 1 ? "s" : ""}`}
        userName={session.user.name ?? ""}
      />
      <OfertaDetalheClient
        offer={{
          id: offer.id,
          title: offer.title,
          type: offer.type,
          referenceNames: offer.referenceNames,
          daysInactive: offer.daysInactive,
          discount: offer.discount,
          discountPct: offer.discountPct,
          messageTemplate: offer.messageTemplate,
          mediaImageUrl: offer.mediaImageUrl,
          customersCount: offer.customersCount,
          status: offer.status,
          createdAt: offer.createdAt.toISOString(),
        }}
        initialCustomers={enriched}
        initialTotal={total}
      />
    </div>
  );
}
