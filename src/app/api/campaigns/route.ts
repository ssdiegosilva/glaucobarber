import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/lib/ai/provider";
import { uploadCampaignImageFromUrl } from "@/lib/storage";
import { checkAiAllowance, consumeAiCredit } from "@/lib/billing";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { theme, objective, channel, offerId } = await req.json();
  if (!theme || !objective) return NextResponse.json({ error: "Tema e objetivo são obrigatórios" }, { status: 400 });

  // Verifica saldo para texto + imagem (2 créditos)
  const allowanceText = await checkAiAllowance(session.user.barbershopId);
  if (!allowanceText.allowed) {
    return NextResponse.json({ error: "ai_limit_reached", message: "Limite de IA atingido. Adicione créditos para continuar.", upgradeUrl: "/billing" }, { status: 402 });
  }

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
  await consumeAiCredit(session.user.barbershopId, "campaign_text");

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
    const allowanceImage = await checkAiAllowance(session.user.barbershopId);
    if (!allowanceImage.allowed) {
      return NextResponse.json({ error: "ai_limit_reached", message: "Limite de IA atingido. Adicione créditos para continuar.", upgradeUrl: "/billing" }, { status: 402 });
    }

    const barbershop = await prisma.barbershop.findUnique({
      where:  { id: session.user.barbershopId },
      select: { name: true, brandStyle: true, campaignReferenceImageUrl: true },
    });

    const brandStyleBlock = barbershop?.brandStyle
      ? `Brand style: ${barbershop.brandStyle}`
      : `Brand style: premium barbershop aesthetic — black background, gold metallic accents, elegant contrast, cinematic lighting, masculine and sophisticated`;

    const referenceNote = barbershop?.campaignReferenceImageUrl
      ? "Use the provided reference photo as the base and preserve key subjects/identity."
      : "";

    const prompt = `
Create a premium square marketing image (1080x1080) for a barbershop brand called "${barbershop?.name ?? "Barbearia"}".

Goal: ${objective || "Promote the barbershop services"}

${brandStyleBlock}
${referenceNote}

Visual direction:
- strong centered composition
- luxury badge or emblem feel
- subtle glow effects
- visually striking focal point
- modern technology blended with barber identity
- possible elements: barber razors, mustache symbol, premium frame, elegant typography

Campaign theme: ${theme}
Art briefing: ${campaign.artBriefing || "elegant premium design, high contrast"}

Important:
- do not make it cartoonish or generic
- do not use cheap promotional aesthetics
- keep the design premium, polished, and brandable
- high contrast, glow, symmetry, and iconic elements
- output must be suitable for a premium social media campaign
`.trim();

    const img = await provider.generateCampaignImage({
      prompt,
      referenceImageUrl: barbershop?.campaignReferenceImageUrl ?? undefined,
    });
    const stored = await uploadCampaignImageFromUrl({
      barbershopId: session.user.barbershopId,
      campaignId: campaign.id,
      sourceUrl: img.url,
    });

    await prisma.campaign.update({ where: { id: campaign.id }, data: { imageUrl: stored.url } });
    campaign.imageUrl = stored.url;
    await consumeAiCredit(session.user.barbershopId, "campaign_image");
  } catch (err) {
    console.error("Erro ao gerar imagem da campanha", err);
  }

  return NextResponse.json({ campaign, ai });
}
