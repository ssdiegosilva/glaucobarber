import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildAvecClient } from "@/lib/integrations/avec/client";
import { buildTrinksClient } from "@/lib/integrations/trinks/client";
import { syncAvecBarbershop } from "@/lib/integrations/avec/sync";
import { syncBarbershop } from "@/lib/integrations/trinks/sync";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const barbershopId = session.user.barbershopId;
  const { provider, enabled } = await req.json() as { provider: string; enabled: boolean };

  if (!provider || typeof enabled !== "boolean") {
    return NextResponse.json({ error: "provider e enabled são obrigatórios" }, { status: 400 });
  }

  const integration = await prisma.integration.findUnique({ where: { barbershopId } });

  if (!integration || integration.provider !== provider) {
    return NextResponse.json({ error: "Integração não encontrada" }, { status: 404 });
  }

  if (!enabled) {
    // Pause: keep configJson (credentials preserved), just deactivate
    await prisma.integration.update({
      where: { barbershopId },
      data:  { status: "UNCONFIGURED", errorMsg: null },
    });
    return NextResponse.json({ ok: true, status: "UNCONFIGURED" });
  }

  // Resume: validate credentials then reactivate
  if (!integration.configJson) {
    return NextResponse.json({ error: "Credenciais não encontradas — reconecte a integração" }, { status: 422 });
  }

  let pingOk = false;
  try {
    if (provider === "avec") {
      pingOk = await buildAvecClient(integration.configJson).ping();
    } else if (provider === "trinks") {
      pingOk = await buildTrinksClient(integration.configJson).ping();
    }
  } catch {
    pingOk = false;
  }

  if (!pingOk) {
    return NextResponse.json(
      { error: "Não foi possível conectar. Verifique as credenciais ou reconecte a integração." },
      { status: 422 }
    );
  }

  await prisma.integration.update({
    where: { barbershopId },
    data:  { status: "ACTIVE", errorMsg: null },
  });

  // Trigger sync in background (fire-and-forget)
  if (provider === "avec") {
    syncAvecBarbershop(barbershopId, "toggle:resume").catch(() => null);
  } else if (provider === "trinks") {
    syncBarbershop(barbershopId, "toggle:resume").catch(() => null);
  }

  return NextResponse.json({ ok: true, status: "ACTIVE" });
}
