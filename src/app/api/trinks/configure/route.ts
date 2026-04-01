import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildTrinksClient } from "@/lib/integrations/trinks/client";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { apiKey, estabelecimentoId } = await req.json();

  if (!apiKey?.trim() || !estabelecimentoId?.trim()) {
    return NextResponse.json({ error: "API Key e ID do estabelecimento são obrigatórios" }, { status: 400 });
  }

  // Test the credentials before saving
  try {
    const configJson = JSON.stringify({ apiKey: apiKey.trim(), estabelecimentoId: estabelecimentoId.trim() });
    const client = buildTrinksClient(configJson);
    await client.getServices(); // lightweight test call
  } catch {
    return NextResponse.json({ error: "Credenciais inválidas. Verifique a API Key e o ID do estabelecimento." }, { status: 422 });
  }

  const configJson = JSON.stringify({ apiKey: apiKey.trim(), estabelecimentoId: estabelecimentoId.trim() });

  await prisma.integration.upsert({
    where:  { barbershopId: session.user.barbershopId },
    create: {
      barbershopId: session.user.barbershopId,
      provider:     "trinks",
      status:       "ACTIVE",
      configJson,
    },
    update: {
      configJson,
      status:   "ACTIVE",
      errorMsg: null,
    },
  });

  await prisma.barbershop.update({
    where: { id: session.user.barbershopId },
    data:  { trinksConfigured: true },
  });

  return NextResponse.json({ ok: true });
}
