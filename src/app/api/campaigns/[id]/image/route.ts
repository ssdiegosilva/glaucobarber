import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/lib/ai/provider";
import { uploadCampaignImage, uploadCampaignImageFromUrl } from "@/lib/storage";
import { checkAiAllowance, consumeAiCredit } from "@/lib/billing";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { promptOverride?: string };

  const { allowed } = await checkAiAllowance(session.user.barbershopId);
  if (!allowed) return NextResponse.json({ error: "ai_limit_reached", message: "Limite de IA atingido. Adicione créditos para continuar.", upgradeUrl: "/billing" }, { status: 402 });

  const campaign = await prisma.campaign.findUnique({ where: { id }, include: { template: true } });
  if (!campaign || campaign.barbershopId !== session.user.barbershopId) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

  const prompt = body.promptOverride ?? `
Create a premium square marketing image (1080x1080) for a barbershop brand called "${barbershop?.name ?? "Barbearia"}".

Goal: ${campaign.title || "Promote the barbershop services"}

${brandStyleBlock}
${referenceNote}

Visual direction:
- strong centered composition
- luxury badge or emblem feel
- subtle glow effects
- visually striking focal point
- modern technology blended with barber identity
- possible elements: barber razors, mustache symbol, premium frame, elegant typography

Campaign theme: ${campaign.title}
Art briefing: ${campaign.artBriefing || "elegant premium design, high contrast"}

Important:
- do not make it cartoonish or generic
- do not use cheap promotional aesthetics
- keep the design premium, polished, and brandable
- high contrast, glow, symmetry, and iconic elements
- output must be suitable for a premium social media campaign
`.trim();

  const styleHint = undefined;

  const provider = getAIProvider();
  try {
    const img = await provider.generateCampaignImage({
      prompt,
      styleHint,
      referenceImageUrl: barbershop?.campaignReferenceImageUrl ?? undefined,
    });

    const stored = "b64" in img
      ? await uploadCampaignImage({
          barbershopId: campaign.barbershopId,
          campaignId:   campaign.id,
          fileName:     `${campaign.id}.png`,
          buffer:       Buffer.from(img.b64, "base64"),
          contentType:  "image/png",
        })
      : await uploadCampaignImageFromUrl({
          barbershopId: campaign.barbershopId,
          campaignId:   campaign.id,
          sourceUrl:    img.url,
        });

    await prisma.campaign.update({ where: { id }, data: { imageUrl: stored.url } });
    await consumeAiCredit(session.user.barbershopId, "campaign_image");
    return NextResponse.json({ url: stored.url });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
