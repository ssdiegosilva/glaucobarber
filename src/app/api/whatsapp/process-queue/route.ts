import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage, sendWhatsAppTemplate } from "@/lib/whatsapp";

// POST /api/whatsapp/process-queue
// Processa todas as mensagens na fila (QUEUED, scheduledFor <= now) para o barbershop autenticado.
export async function POST() {
  const session = await auth();
  if (!session?.user?.barbershopId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const barbershopId = session.user.barbershopId;
  const now = new Date();

  const pending = await prisma.whatsappMessage.findMany({
    where: {
      barbershopId,
      status:       "QUEUED",
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
    },
    include: {
      barbershop: {
        include: {
          integration: {
            select: { whatsappAccessToken: true, whatsappPhoneNumberId: true },
          },
        },
      },
    },
    orderBy: { scheduledFor: "asc" },
  });

  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  for (const msg of pending) {
    const integration = msg.barbershop?.integration;
    if (!integration?.whatsappAccessToken || !integration?.whatsappPhoneNumberId) {
      results.push({ id: msg.id, ok: false, error: "WhatsApp não configurado" });
      continue;
    }

    const creds = {
      accessToken:   integration.whatsappAccessToken,
      phoneNumberId: integration.whatsappPhoneNumberId,
    };

    try {
      let metaMessageId: string;

      if (msg.messageKind === "template" && msg.templateName) {
        const vars: string[] = msg.templateVars ? JSON.parse(msg.templateVars) : [];
        metaMessageId = await sendWhatsAppTemplate(msg.phone, msg.templateName, vars, creds);
      } else {
        metaMessageId = await sendWhatsAppMessage(msg.phone, msg.message, creds);
      }

      await prisma.whatsappMessage.update({
        where: { id: msg.id },
        data:  { status: "SENT", sentAt: new Date(), metaMessageId },
      });
      results.push({ id: msg.id, ok: true });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await prisma.whatsappMessage.update({
        where: { id: msg.id },
        data:  { status: "FAILED", errorMessage },
      });
      results.push({ id: msg.id, ok: false, error: errorMessage });
    }
  }

  return NextResponse.json({
    total:  pending.length,
    sent:   results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
  });
}
