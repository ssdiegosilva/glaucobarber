import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/lib/ai/provider";
import { uploadCampaignImage, uploadCampaignImageFromUrl } from "@/lib/storage";
import { checkAiAllowance, consumeAiCredit } from "@/lib/billing";
import { getAiImageConfig } from "@/lib/platform-config";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { theme, objective, channel, offerId } = await req.json();
  if (!theme) return NextResponse.json({ error: "Tema é obrigatório" }, { status: 400 });

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
  const context = `Barbearia: ${session.user.barbershopId}. Tema: ${theme}.${offerContext}`;
  const ai = await provider.generateCampaignText(theme, context);
  await consumeAiCredit(session.user.barbershopId, "campaign_text");

  const campaign = await prisma.campaign.create({
    data: {
      barbershopId: session.user.barbershopId,
      status:      "GENERATING",
      title:       theme,
      objective:   objective ?? "",
      text:        ai.text || "",
      artBriefing: ai.artBriefing || "",
      channel:     channel ?? "instagram",
      offerId:     offerId ?? null,
    },
  });

  // Gera imagem em background — responde ao cliente imediatamente
  const barbershopId = session.user.barbershopId;
  const campaignId   = campaign.id;

  after(async () => {
    try {
      const allowanceImage = await checkAiAllowance(barbershopId);
      if (!allowanceImage.allowed) {
        await prisma.campaign.update({ where: { id: campaignId }, data: { status: "DRAFT" } });
        return;
      }

      const barbershop = await prisma.barbershop.findUnique({
        where:  { id: barbershopId },
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

Goal: ${theme}

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

      const aiConfig = await getAiImageConfig();
      const img = await provider.generateCampaignImage({
        prompt,
        referenceImageUrl: barbershop?.campaignReferenceImageUrl ?? undefined,
        model:   aiConfig.model,
        size:    aiConfig.size,
        quality: aiConfig.quality,
      });

      const stored = "b64" in img
        ? await uploadCampaignImage({
            barbershopId,
            campaignId,
            fileName:    `${campaignId}.png`,
            buffer:      Buffer.from(img.b64, "base64"),
            contentType: "image/png",
          })
        : await uploadCampaignImageFromUrl({
            barbershopId,
            campaignId,
            sourceUrl: img.url,
          });

      await prisma.campaign.update({ where: { id: campaignId }, data: { imageUrl: stored.url, status: "DRAFT" } });
      await consumeAiCredit(barbershopId, "campaign_image");
    } catch (err) {
      console.error("[campaign/image] Erro ao gerar imagem:", err);
      // Mesmo sem imagem, move para DRAFT para o usuário poder agir
      await prisma.campaign.update({ where: { id: campaignId }, data: { status: "DRAFT" } }).catch(() => {});
    }

    // Notificação no sininho
    try {
      await prisma.systemNotification.create({
        data: {
          barbershopId,
          type:  "SYSTEM",
          title: "Campanha pronta para aprovação",
          body:  `"${campaign.title}" foi criada pela IA e está aguardando sua aprovação.`,
          link:  `/campaigns#campaign-${campaignId}`,
        },
      });
    } catch (err) {
      console.error("Erro ao criar notificação de campanha", err);
    }
  });

  return NextResponse.json({ campaign, ai });
}
