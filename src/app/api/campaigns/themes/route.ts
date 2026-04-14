import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/lib/ai/provider";
import { checkAiAllowance, consumeAiCredit } from "@/lib/billing";

export async function POST() {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed } = await checkAiAllowance(session.user.barbershopId);
  if (!allowed) {
    return NextResponse.json({ error: "ai_limit_reached", message: "Limite de IA atingido.", upgradeUrl: "/billing" }, { status: 402 });
  }

  const barbershop = await prisma.barbershop.findUnique({
    where: { id: session.user.barbershopId },
    select: { name: true, segment: { select: { tenantLabel: true } } },
  });

  const tenantLabel = barbershop?.segment?.tenantLabel ?? "barbearia";
  const provider = getAIProvider();
  const result = await provider.generateCampaignThemes(barbershop?.name ?? "Estabelecimento", undefined, tenantLabel);
  await consumeAiCredit(session.user.barbershopId, "campaign_themes");

  return NextResponse.json(result);
}
