// ============================================================
// WhatsApp Send Cron – roda a cada 15 min
// Processa mensagens agendadas (scheduledFor <= now) e envia via Meta API
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage, sendWhatsAppTemplate, sendWhatsAppImage } from "@/lib/whatsapp";
import { getKillSwitch } from "@/lib/platform-config";
import { after } from "next/server";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (await getKillSwitch("kill_whatsapp_auto")) {
    return NextResponse.json({ date: new Date().toISOString(), skipped: true, reason: "kill_whatsapp_auto" });
  }

  after(async () => {
    const now   = new Date();
    const start = Date.now();
    const run   = await prisma.cronRun.create({ data: { cronName: "whatsapp-send", status: "running" } });

    try {
      const pending = await prisma.whatsappMessage.findMany({
        where: {
          status: "QUEUED",
          messageKind: { in: ["template", "image"] },
          scheduledFor: { lte: now },
        },
        include: {
          barbershop: {
            include: {
              integration: { select: { whatsappAccessToken: true, whatsappPhoneNumberId: true } },
            },
          },
        },
        orderBy: { scheduledFor: "asc" },
        take: 100,
      });

      const results: Array<{ id: string; ok: boolean; error?: string }> = [];

      for (const msg of pending) {
        const integration = msg.barbershop?.integration;
        if (!integration?.whatsappAccessToken || !integration?.whatsappPhoneNumberId) {
          results.push({ id: msg.id, ok: false, error: "WhatsApp não configurado" });
          continue;
        }
        const creds = { accessToken: integration.whatsappAccessToken, phoneNumberId: integration.whatsappPhoneNumberId };

        try {
          let metaMessageId: string;
          if (msg.messageKind === "image" && msg.mediaImageUrl) {
            metaMessageId = await sendWhatsAppImage(msg.phone, msg.mediaImageUrl, msg.message, creds);
          } else if (msg.messageKind === "template" && msg.templateName) {
            const vars: string[] = msg.templateVars ? JSON.parse(msg.templateVars) : [];
            metaMessageId = await sendWhatsAppTemplate(msg.phone, msg.templateName, vars, creds);
          } else {
            metaMessageId = await sendWhatsAppMessage(msg.phone, msg.message, creds);
          }
          await prisma.whatsappMessage.update({ where: { id: msg.id }, data: { status: "SENT", sentAt: new Date(), metaMessageId } });
          results.push({ id: msg.id, ok: true });
        } catch (err) {
          console.error(`[WhatsApp Cron] Falha ${msg.id}:`, err);
          await prisma.whatsappMessage.update({ where: { id: msg.id }, data: { status: "FAILED" } });
          results.push({ id: msg.id, ok: false, error: String(err) });
        }
      }

      await prisma.cronRun.update({
        where: { id: run.id },
        data: { status: results.some((r) => !r.ok) ? "partial" : "success", durationMs: Date.now() - start },
      });
    } catch (err) {
      await prisma.cronRun.update({ where: { id: run.id }, data: { status: "failed", durationMs: Date.now() - start, error: String(err) } });
    }
  });

  return NextResponse.json({ date: new Date().toISOString(), accepted: true });
}
