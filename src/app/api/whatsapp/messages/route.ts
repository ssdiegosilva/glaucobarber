import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay, subDays } from "date-fns";
import { sendWhatsAppMessage, sendWhatsAppTemplate, type WhatsAppCredentials } from "@/lib/whatsapp";

/** Busca as credenciais WhatsApp do barbershop. Retorna null se não configurado. */
async function getWhatsAppCreds(barbershopId: string): Promise<WhatsAppCredentials | null> {
  const integration = await prisma.integration.findUnique({
    where:  { barbershopId },
    select: { whatsappAccessToken: true, whatsappPhoneNumberId: true },
  });
  if (!integration?.whatsappAccessToken || !integration?.whatsappPhoneNumberId) return null;
  return {
    accessToken:   integration.whatsappAccessToken,
    phoneNumberId: integration.whatsappPhoneNumberId,
  };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    customerId, customerName, phone, message, type, scheduledFor,
    messageKind, templateName, templateVars,
  } = await req.json();
  if (!customerName || !phone || !message) {
    return NextResponse.json({ error: "customerName, phone e message são obrigatórios" }, { status: 400 });
  }

  const isScheduled = !!scheduledFor;
  const kind = messageKind === "template" ? "template" : "text";

  const [msg] = await prisma.$transaction([
    prisma.whatsappMessage.create({
      data: {
        barbershopId: session.user.barbershopId,
        customerId:   customerId ?? null,
        customerName,
        phone,
        message,
        type:         type ?? "general",
        messageKind:  kind,
        templateName: kind === "template" ? (templateName ?? null) : null,
        templateVars: kind === "template" && templateVars
          ? JSON.stringify(templateVars)
          : null,
        status:       "QUEUED",
        scheduledFor: isScheduled ? new Date(scheduledFor) : null,
      },
    }),
    // Track quando o cliente foi contatado pela última vez
    ...(customerId ? [
      prisma.customer.update({
        where: { id: customerId },
        data:  { lastWhatsappSentAt: new Date() },
      }),
    ] : []),
  ]);

  // Se não for agendada, tenta enviar imediatamente
  if (!isScheduled) {
    const creds = await getWhatsAppCreds(session.user.barbershopId);

    if (!creds) {
      // WhatsApp não configurado – mantém na fila para envio manual ou futuro
      return NextResponse.json(
        { message: msg, warning: "WhatsApp não configurado para este barbershop." },
        { status: 201 }
      );
    }

    try {
      const metaMessageId = kind === "template" && templateName
        ? await sendWhatsAppTemplate(phone, templateName, templateVars ?? [], creds)
        : await sendWhatsAppMessage(phone, message, creds);
      await prisma.whatsappMessage.update({
        where: { id: msg.id },
        data:  { status: "SENT", sentAt: new Date(), metaMessageId },
      });
      return NextResponse.json({ message: { ...msg, status: "SENT", metaMessageId } }, { status: 201 });
    } catch (err) {
      console.error("[WhatsApp] Falha ao enviar mensagem:", err);
      await prisma.whatsappMessage.update({
        where: { id: msg.id },
        data:  { status: "FAILED" },
      });
      return NextResponse.json({ message: { ...msg, status: "FAILED" } }, { status: 201 });
    }
  }

  return NextResponse.json({ message: msg }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const tab = searchParams.get("tab") ?? "today"; // today | queue | history

  const barbershopId = session.user.barbershopId;
  const now = new Date();

  if (tab === "today") {
    const messages = await prisma.whatsappMessage.findMany({
      where: { barbershopId, createdAt: { gte: startOfDay(now), lte: endOfDay(now) } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ messages });
  }

  if (tab === "queue") {
    const messages = await prisma.whatsappMessage.findMany({
      where: { barbershopId, status: "QUEUED" },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ messages });
  }

  // history: last 7 days, SENT only
  const messages = await prisma.whatsappMessage.findMany({
    where: {
      barbershopId,
      status: "SENT",
      sentAt: { gte: subDays(now, 7) },
    },
    orderBy: { sentAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ messages });
}
