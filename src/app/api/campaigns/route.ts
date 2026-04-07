import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/lib/ai/provider";
import { uploadCampaignImage, uploadCampaignImageFromUrl } from "@/lib/storage";
import { checkAiAllowance, consumeAiCredit } from "@/lib/billing";
import { getAiImageConfig, getKillSwitch, tierToApiQuality, tierToUsdCents, type ImageQualityTier } from "@/lib/platform-config";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  // Strip ASCII control characters (mobile keyboards can insert null bytes / special chars that break JSON serialization)
  const sanitize = (s: unknown) => typeof s === "string" ? s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim() : s;
  const theme        = sanitize(body.theme)     as string | undefined;
  const objective    = sanitize(body.objective) as string | undefined;
  const channel      = sanitize(body.channel)   as string | undefined;
  const offerId      = body.offerId             as string | undefined;
  const imageQuality = (body.imageQuality ?? "medium") as ImageQualityTier;
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
  let ai: { text: string; artBriefing: string };
  try {
    ai = await provider.generateCampaignText(theme, context);
  } catch (err) {
    console.error("[campaign/text] Erro ao gerar texto:", err, { theme, context });
    return NextResponse.json({ error: "Falha ao gerar campanha. Tente novamente." }, { status: 500 });
  }
  await consumeAiCredit(session.user.barbershopId, "campaign_text");

  // Busca dados da barbearia para gerar imagem
  const barbershop = await prisma.barbershop.findUnique({
    where:  { id: session.user.barbershopId },
    select: { name: true, brandStyle: true, campaignReferenceImageUrl: true },
  });

  // Monta prompt da imagem usando o artBriefing gerado pelo texto
  const brandStyleBlock = barbershop?.brandStyle
    ? `Brand style: ${barbershop.brandStyle}`
    : `Brand style: premium barbershop aesthetic — black background, gold metallic accents, elegant contrast, cinematic lighting, masculine and sophisticated`;

  const referenceNote = barbershop?.campaignReferenceImageUrl
    ? "Use the provided reference photo as the base and preserve key subjects/identity."
    : "";

  const imagePrompt = `
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
Art briefing: ${ai.artBriefing || "elegant premium design, high contrast"}

Important:
- do not make it cartoonish or generic
- do not use cheap promotional aesthetics
- keep the design premium, polished, and brandable
- high contrast, glow, symmetry, and iconic elements
- output must be suitable for a premium social media campaign
`.trim();

  // Gera imagem agora (síncrono) — campanha só vai para DRAFT quando estiver completa
  let imageUrl: string | null = null;
  const [allowanceImage, imageKilled] = await Promise.all([
    checkAiAllowance(session.user.barbershopId),
    getKillSwitch("kill_image_generation"),
  ]);
  if (allowanceImage.allowed && !imageKilled) {
    try {
      const aiConfig   = await getAiImageConfig();
      const apiQuality = tierToApiQuality(imageQuality, aiConfig.model);
      const usdCents   = tierToUsdCents(imageQuality, aiConfig.model);
      const credits    = imageQuality === "low"  ? aiConfig.creditCostLow
                       : imageQuality === "high" ? aiConfig.creditCostHigh
                       : aiConfig.creditCostMedium;
      const img = await provider.generateCampaignImage({
        prompt:            imagePrompt,
        referenceImageUrl: barbershop?.campaignReferenceImageUrl ?? undefined,
        model:   aiConfig.model,
        size:    aiConfig.size,
        quality: apiQuality,
      });

      // Cria registro no DB para ter o ID antes de fazer upload
      const tempCampaign = await prisma.campaign.create({
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

      const stored = "b64" in img
        ? await uploadCampaignImage({
            barbershopId: session.user.barbershopId,
            campaignId:   tempCampaign.id,
            fileName:     `${tempCampaign.id}.png`,
            buffer:       Buffer.from(img.b64, "base64"),
            contentType:  "image/png",
          })
        : await uploadCampaignImageFromUrl({
            barbershopId: session.user.barbershopId,
            campaignId:   tempCampaign.id,
            sourceUrl:    img.url,
          });

      imageUrl = stored.url;
      await consumeAiCredit(session.user.barbershopId, "campaign_image", { credits, usdCents });

      const campaign = await prisma.campaign.update({
        where: { id: tempCampaign.id },
        data:  { imageUrl, status: "DRAFT" },
      });

      // Notificação no sininho
      try {
        await prisma.systemNotification.create({
          data: {
            barbershopId: session.user.barbershopId,
            type:  "SYSTEM",
            title: "Campanha pronta para aprovação",
            body:  `"${campaign.title}" foi criada pela IA e está aguardando sua aprovação.`,
            link:  `/campaigns#campaign-${campaign.id}`,
          },
        });
      } catch {}

      return NextResponse.json({ campaign, ai });
    } catch (err) {
      console.error("[campaign/image] Erro ao gerar imagem:", err);
      // Imagem falhou — cria campanha sem imagem para o usuário poder gerar depois
    }
  }

  // Fallback: cria sem imagem (sem crédito ou erro na geração)
  const campaign = await prisma.campaign.create({
    data: {
      barbershopId: session.user.barbershopId,
      status:      "DRAFT",
      title:       theme,
      objective:   objective ?? "",
      text:        ai.text || "",
      artBriefing: ai.artBriefing || "",
      channel:     channel ?? "instagram",
      offerId:     offerId ?? null,
    },
  });

  try {
    await prisma.systemNotification.create({
      data: {
        barbershopId: session.user.barbershopId,
        type:  "SYSTEM",
        title: "Campanha pronta para aprovação",
        body:  `"${campaign.title}" foi criada (sem arte) e está aguardando sua aprovação.`,
        link:  `/campaigns#campaign-${campaign.id}`,
      },
    });
  } catch {}

  return NextResponse.json({ campaign, ai });
}
