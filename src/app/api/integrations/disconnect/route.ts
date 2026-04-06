import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PROVIDERS = ["trinks", "avec", "instagram", "whatsapp"] as const;
type Provider = typeof PROVIDERS[number];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { provider } = await req.json() as { provider: Provider };
  if (!PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "Provider inválido" }, { status: 400 });
  }

  const barbershopId = session.user.barbershopId;

  const integration = await prisma.integration.findUnique({ where: { barbershopId } });
  if (!integration) {
    return NextResponse.json({ error: "Integração não encontrada" }, { status: 404 });
  }

  if (provider === "trinks") {
    await Promise.all([
      prisma.integration.update({
        where: { barbershopId },
        data: {
          configJson: null,
          status:     "UNCONFIGURED",
          errorMsg:   null,
          lastSyncAt: null,
        },
      }),
      prisma.barbershop.update({
        where: { id: barbershopId },
        data:  { trinksConfigured: false },
      }),
    ]);
    // Note: trinksId fields are intentionally preserved for deduplication on reconnect
  }

  if (provider === "avec") {
    await prisma.integration.update({
      where: { barbershopId },
      data: {
        configJson: null,
        status:     "UNCONFIGURED",
        errorMsg:   null,
        lastSyncAt: null,
      },
    });
    // Note: avecId fields are intentionally preserved for deduplication on reconnect
  }

  if (provider === "instagram") {
    await prisma.integration.update({
      where: { barbershopId },
      data: {
        instagramPageAccessToken: null,
        instagramBusinessId:      null,
        instagramPageId:          null,
        instagramUsername:        null,
      },
    });
  }

  if (provider === "whatsapp") {
    await prisma.integration.update({
      where: { barbershopId },
      data: {
        whatsappAccessToken:   null,
        whatsappPhoneNumberId: null,
        whatsappVerifyToken:   null,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
