import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/lib/ai/provider";
import { checkAiAllowance, consumeAiCredit } from "@/lib/billing";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const sanitize = (s: unknown) => typeof s === "string" ? s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim() : s;
  const theme     = sanitize(body.theme)     as string | undefined;
  const objective = sanitize(body.objective) as string | undefined;
  const channel   = sanitize(body.channel)   as string | undefined;
  const offerId   = body.offerId             as string | undefined;
  if (!theme) return NextResponse.json({ error: "Tema é obrigatório" }, { status: 400 });

  const allowance = await checkAiAllowance(session.user.barbershopId);
  if (!allowance.allowed) {
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

  const barbershop = await prisma.barbershop.findUnique({
    where:  { id: session.user.barbershopId },
    select: { name: true },
  });

  const provider = getAIProvider();
  const context = `Barbearia: ${barbershop?.name ?? "Barbearia"}. Tema: ${theme}.${offerContext}`;
  let ai: { text: string; artBriefing: string };
  try {
    ai = await provider.generateCampaignText(theme, context, session.user.barbershopId);
  } catch (err) {
    console.error("[campaign/text] Erro ao gerar texto:", err, { theme, context });
    return NextResponse.json({ error: "Falha ao gerar campanha. Tente novamente." }, { status: 500 });
  }
  await consumeAiCredit(session.user.barbershopId, "campaign_text");

  // Cria campanha só com texto — imagem será gerada depois a pedido do usuário
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
        title: "Campanha pronta",
        body:  `"${campaign.title}" foi criada. Adicione a imagem para publicar.`,
        link:  `/campaigns#campaign-${campaign.id}`,
      },
    });
  } catch {}

  return NextResponse.json({ campaign, ai });
}
