import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/lib/ai/provider";
import { uploadCampaignImageFromUrl } from "@/lib/storage";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { theme, objective, channel, offerId } = await req.json();
  if (!theme || !objective) return NextResponse.json({ error: "Tema e objetivo são obrigatórios" }, { status: 400 });

  // Build offer context for AI if offer is linked
  let offerContext = "";
  if (offerId) {
    const offer = await prisma.offer.findFirst({
      where:   { id: offerId, barbershopId: session.user.barbershopId },
      include: { items: { include: { service: { select: { name: true } } } } },
    });
    if (offer) {
      const serviceNames = offer.items.map((i) => i.service.name).join(", ") || offer.title;
      offerContext = ` Esta campanha promove a oferta especial "${offer.title}" — ${serviceNames} por R$ ${Number(offer.salePrice).toFixed(2)} (de R$ ${Number(offer.originalPrice).toFixed(2)}). Mencione o valor especial e os serviços incluídos no texto.`;
    }
  }

  const provider = getAIProvider();
  const context = `Barbearia: ${session.user.barbershopId}. Tema: ${theme}. Objetivo: ${objective}.${offerContext}`;
  const ai = await provider.generateCampaignText(objective, context);

  const campaign = await prisma.campaign.create({
    data: {
      barbershopId: session.user.barbershopId,
      status:      "DRAFT",
      title:       theme,
      objective,
      text:        ai.text || "",
      artBriefing: ai.artBriefing || "",
      channel:     channel ?? "instagram",
      offerId:     offerId ?? null,
    },
  });

  // Gera arte imediatamente para reduzir atrito
  try {
    const barbershop = await prisma.barbershop.findUnique({ where: { id: session.user.barbershopId } });
    const prompt = `Crie uma arte quadrada (1080x1080) para Instagram de uma barbearia premium.
- Marca: ${barbershop?.name ?? "Barbearia"}
- Tema: ${theme}
- Objetivo: ${objective}
- Texto base: ${campaign.text}
- Briefing: ${campaign.artBriefing || "estilo elegante, premium"}
Use cores e estética premium, legível e moderna.`;

    const img = await provider.generateCampaignImage({ prompt });
    const stored = await uploadCampaignImageFromUrl({
      barbershopId: session.user.barbershopId,
      campaignId: campaign.id,
      sourceUrl: img.url,
    });

    await prisma.campaign.update({ where: { id: campaign.id }, data: { imageUrl: stored.url } });
    campaign.imageUrl = stored.url;
  } catch (err) {
    console.error("Erro ao gerar imagem da campanha", err);
  }

  return NextResponse.json({ campaign, ai });
}
