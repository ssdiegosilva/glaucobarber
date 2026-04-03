import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";
import { checkAiAllowance, consumeAiCredit } from "@/lib/billing";

const MODEL = process.env.AI_MODEL ?? "gpt-4o-mini";

// POST /api/post-sale/generate-message
// Generates a ready-to-send personalized WhatsApp message for post-sale actions.
// Body: { actionType, customerName, serviceName?, daysSinceVisit?, googleReviewUrl? }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const barbershopId = session.user.barbershopId;

  const { allowed } = await checkAiAllowance(barbershopId);
  if (!allowed) {
    return NextResponse.json(
      { error: "ai_limit_reached", message: "Limite de IA atingido.", upgradeUrl: "/billing" },
      { status: 402 }
    );
  }

  const { actionType, customerName, serviceName, daysSinceVisit, googleReviewUrl } = await req.json() as {
    actionType: string;
    customerName: string;
    serviceName?: string;
    daysSinceVisit?: number;
    googleReviewUrl?: string;
  };

  if (!actionType || !customerName?.trim()) {
    return NextResponse.json({ error: "actionType e customerName são obrigatórios" }, { status: 400 });
  }

  const barbershop = await prisma.barbershop.findUnique({
    where:  { id: barbershopId },
    select: { name: true },
  });

  const shopName  = barbershop?.name ?? "nossa barbearia";
  const name      = customerName.trim();
  const service   = serviceName ?? "corte";
  const days      = daysSinceVisit ?? 0;

  let systemPrompt = `Você é especialista em comunicação para barbearias. Escreva mensagens de WhatsApp diretas, calorosas e curtas (máximo 3 parágrafos). Sem asteriscos, sem markdown. Termine sempre com "Equipe ${shopName}".`;

  let userPrompt: string;

  switch (actionType) {
    case "reactivation":
      userPrompt = `Escreva uma mensagem de reativação para o cliente "${name}" da barbearia "${shopName}". Ele está há ${days} dias sem visitar e o último serviço foi "${service}". Seja saudoso, pessoal e inclua um convite para retornar.`;
      break;

    case "reactivation_promo":
      userPrompt = `Escreva uma mensagem com oferta especial para reativar o cliente "${name}" da barbearia "${shopName}". Ele está há ${days} dias sem visitar. Crie uma oferta atrativa (desconto, brinde ou combo) para motivá-lo a voltar.`;
      break;

    case "post_sale_followup":
      userPrompt = `Escreva uma mensagem de boas-vindas de volta para o cliente "${name}" da barbearia "${shopName}". Ele voltou depois de um tempo ausente. Celebre o retorno e incentive a regularidade das visitas.`;
      break;

    case "post_sale_review":
      if (!googleReviewUrl) {
        return NextResponse.json({ error: "googleReviewUrl é necessário para este tipo de mensagem" }, { status: 400 });
      }
      userPrompt = `Escreva uma mensagem pedindo avaliação no Google para o cliente "${name}" após ser atendido na barbearia "${shopName}" com o serviço "${service}". Inclua este link exatamente: ${googleReviewUrl}. Seja breve e simpático.`;
      break;

    default:
      return NextResponse.json({ error: "actionType inválido" }, { status: 400 });
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model:      MODEL,
      max_tokens: 350,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
    });

    const message = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!message) return NextResponse.json({ error: "IA não retornou mensagem" }, { status: 500 });

    await consumeAiCredit(barbershopId, "post_sale");
    return NextResponse.json({ message });
  } catch {
    return NextResponse.json({ error: "Erro ao gerar mensagem" }, { status: 500 });
  }
}
