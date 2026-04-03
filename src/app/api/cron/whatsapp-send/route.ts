// ============================================================
// WhatsApp Send Cron – roda a cada 15 min (configurado em vercel.json)
// Processa mensagens agendadas (scheduledFor <= now) e envia via Meta API
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage, sendWhatsAppTemplate } from "@/lib/whatsapp";

export async function GET(req: NextRequest) {
  // Verifica secret do cron
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Busca mensagens agendadas prontas para enviar, junto com as credenciais do barbershop
  const pending = await prisma.whatsappMessage.findMany({
    where: {
      status:      "QUEUED",
      messageKind: "template",   // bot só envia templates; texto livre é sempre manual
      scheduledFor: { lte: now },
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
    take: 100, // limite por execução para evitar timeout
  });

  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  for (const msg of pending) {
    const integration = msg.barbershop?.integration;
    if (!integration?.whatsappAccessToken || !integration?.whatsappPhoneNumberId) {
      results.push({ id: msg.id, ok: false, error: "WhatsApp não configurado para este barbershop" });
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
      console.error(`[WhatsApp Cron] Falha ao enviar ${msg.id}:`, err);
      await prisma.whatsappMessage.update({
        where: { id: msg.id },
        data:  { status: "FAILED" },
      });
      results.push({ id: msg.id, ok: false, error: String(err) });
    }
  }

  return NextResponse.json({
    date:    now.toISOString(),
    total:   pending.length,
    sent:    results.filter((r) => r.ok).length,
    failed:  results.filter((r) => !r.ok).length,
    results,
  });
}
