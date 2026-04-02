// ============================================================
// WhatsApp Webhook – por barbershop
//
// URL: /api/whatsapp/webhook/[barbershopId]
//
// GET  → Verificação Meta (hub.challenge)
//         O verifyToken é gerado automaticamente na primeira chamada
//         e armazenado em Integration.whatsappVerifyToken.
//         O barbershop owner não precisa criá-lo — apenas copia do painel.
//
// POST → Delivery status updates (sent/delivered/read/failed)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { extractDeliveryStatuses, type WhatsAppWebhookBody } from "@/lib/whatsapp";

// GET: Meta verifica o webhook enviando hub.challenge
export async function GET(
  req:     NextRequest,
  { params }: { params: Promise<{ barbershopId: string }> }
) {
  const { barbershopId } = await params;
  const { searchParams }  = req.nextUrl;

  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode !== "subscribe" || !token) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Busca (ou cria) o Integration do barbershop
  let integration = await prisma.integration.findUnique({
    where:  { barbershopId },
    select: { id: true, whatsappVerifyToken: true },
  });

  if (!integration) {
    return NextResponse.json({ error: "Barbershop não encontrado" }, { status: 404 });
  }

  // Auto-gera o verifyToken na primeira vez — o usuário nunca precisa criá-lo manualmente
  if (!integration.whatsappVerifyToken) {
    const generated = randomUUID();
    await prisma.integration.update({
      where: { id: integration.id },
      data:  { whatsappVerifyToken: generated },
    });
    integration = { ...integration, whatsappVerifyToken: generated };
  }

  if (token !== integration.whatsappVerifyToken) {
    return NextResponse.json({ error: "Token inválido" }, { status: 403 });
  }

  return new NextResponse(challenge, { status: 200 });
}

// POST: recebe eventos de delivery status e atualiza o DB
export async function POST(
  req:     NextRequest,
  { params }: { params: Promise<{ barbershopId: string }> }
) {
  const { barbershopId } = await params;

  let body: WhatsAppWebhookBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const statuses = extractDeliveryStatuses(body);

  if (statuses.length > 0) {
    await Promise.allSettled(
      statuses
        .filter((s) => s.status === "failed")
        .map(({ metaMessageId }) =>
          prisma.whatsappMessage.updateMany({
            where: { metaMessageId, barbershopId },
            data:  { status: "FAILED" },
          })
        )
    );
  }

  // Meta exige 200 OK rápido
  return NextResponse.json({ ok: true });
}
