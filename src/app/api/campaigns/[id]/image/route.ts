import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/lib/ai/provider";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { promptOverride?: string };

  const campaign = await prisma.campaign.findUnique({ where: { id }, include: { template: true } });
  if (!campaign || campaign.barbershopId !== session.user.barbershopId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const barbershop = await prisma.barbershop.findUnique({ where: { id: session.user.barbershopId } });

  const prompt = body.promptOverride ?? `Crie uma arte quadrada (1080x1080) para Instagram de uma barbearia premium.
- Marca: ${barbershop?.name ?? "Barbearia"}
- Tema: ${campaign.title}
- Objetivo: ${campaign.objective}
- Texto base: ${campaign.text}
- Briefing: ${campaign.artBriefing || "estilo elegante, premium"}
Use cores e estética premium, legível e moderna.`;

  const styleHint = campaign.template?.imageUrl ? `Referência visual: ${campaign.template.imageUrl}` : undefined;

  const provider = getAIProvider();
  try {
    const img = await provider.generateCampaignImage({ prompt, styleHint });
    await prisma.campaign.update({ where: { id }, data: { imageUrl: img.url } });
    return NextResponse.json({ url: img.url });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
