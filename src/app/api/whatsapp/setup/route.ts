// ============================================================
// WhatsApp Setup – gera e retorna as informações de webhook
// que o barbershop owner precisa copiar no painel da Meta.
//
// GET  → retorna { webhookUrl, verifyToken } (gera token se ainda não existe)
// POST → salva accessToken e phoneNumberId do barbershop
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function getBaseUrl(req: NextRequest) {
  const host = req.headers.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}

// GET: retorna a URL do webhook e o verify token (auto-gerado)
// O usuário só precisa copiar esses dois valores no painel Meta.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const barbershopId = session.user.barbershopId;

  let integration = await prisma.integration.findUnique({
    where:  { barbershopId },
    select: { id: true, whatsappVerifyToken: true, whatsappAccessToken: true, whatsappPhoneNumberId: true },
  });

  if (!integration) {
    return NextResponse.json({ error: "Integration não encontrada" }, { status: 404 });
  }

  // Auto-gera o verifyToken se ainda não existe
  if (!integration.whatsappVerifyToken) {
    const generated = randomUUID();
    await prisma.integration.update({
      where: { id: integration.id },
      data:  { whatsappVerifyToken: generated },
    });
    integration = { ...integration, whatsappVerifyToken: generated };
  }

  const base       = getBaseUrl(req);
  const webhookUrl = `${base}/api/whatsapp/webhook/${barbershopId}`;

  return NextResponse.json({
    webhookUrl,
    verifyToken:       integration.whatsappVerifyToken,
    isConfigured:      !!(integration.whatsappAccessToken && integration.whatsappPhoneNumberId),
    hasPhoneNumberId:  !!integration.whatsappPhoneNumberId,
    hasAccessToken:    !!integration.whatsappAccessToken,
  });
}

// POST: salva as credenciais Meta do barbershop
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { accessToken, phoneNumberId, wabaId } = await req.json();
  if (!accessToken || !phoneNumberId) {
    return NextResponse.json({ error: "accessToken e phoneNumberId são obrigatórios" }, { status: 400 });
  }

  await prisma.integration.update({
    where: { barbershopId: session.user.barbershopId },
    data: {
      whatsappAccessToken:   accessToken,
      whatsappPhoneNumberId: phoneNumberId,
      ...(wabaId !== undefined && { whatsappWabaId: wabaId || null }),
    },
  });

  return NextResponse.json({ ok: true });
}

// PATCH: atualiza só o WABA ID (sem mexer no token/phoneId)
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { wabaId } = await req.json();
  await prisma.integration.update({
    where: { barbershopId: session.user.barbershopId },
    data:  { whatsappWabaId: wabaId || null },
  });

  return NextResponse.json({ ok: true });
}

// DELETE: remove as credenciais WhatsApp
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.integration.updateMany({
    where: { barbershopId: session.user.barbershopId },
    data: {
      whatsappAccessToken:   null,
      whatsappPhoneNumberId: null,
    },
  });

  return NextResponse.json({ ok: true });
}
