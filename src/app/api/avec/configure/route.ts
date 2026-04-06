import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AvecClient } from "@/lib/integrations/avec/client";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const barbershopId = session.user.barbershopId;
  const { token, baseUrl } = await req.json();

  if (!token || !baseUrl) {
    return NextResponse.json({ error: "token e baseUrl são obrigatórios" }, { status: 400 });
  }

  // Validate credentials
  const client = new AvecClient({ token, baseUrl });
  const ok = await client.ping();
  if (!ok) {
    return NextResponse.json(
      { error: "Não foi possível conectar à Avec. Verifique o token e a URL." },
      { status: 422 }
    );
  }

  // Deactivate any existing different provider (preserves IDs for deduplication)
  const existing = await prisma.integration.findUnique({ where: { barbershopId } });
  if (existing && existing.provider !== "avec") {
    await prisma.integration.update({
      where: { barbershopId },
      data:  { configJson: null, status: "UNCONFIGURED", errorMsg: null, lastSyncAt: null },
    });
  }

  // Upsert Avec integration
  await prisma.integration.upsert({
    where:  { barbershopId },
    create: {
      barbershopId,
      provider:   "avec",
      configJson: JSON.stringify({ token, baseUrl }),
      status:     "ACTIVE",
    },
    update: {
      provider:   "avec",
      configJson: JSON.stringify({ token, baseUrl }),
      status:     "ACTIVE",
      errorMsg:   null,
    },
  });

  return NextResponse.json({ ok: true });
}
