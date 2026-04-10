import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";
import { checkAiAllowance, consumeAiCredit } from "@/lib/billing";

const CATEGORY_PT: Record<string, string> = {
  HAIRCUT:   "corte de cabelo",
  BEARD:     "barba",
  COMBO:     "combo (corte + barba)",
  TREATMENT: "tratamento capilar",
  OTHER:     "serviço de barbearia",
};

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.barbershopId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { allowed } = await checkAiAllowance(session.user.barbershopId);
  if (!allowed) return NextResponse.json({ error: "ai_limit_reached", message: "Limite de IA atingido. Adicione créditos para continuar.", upgradeUrl: "/billing" }, { status: 402 });

  const { id } = await params;

  const [service, barbershop] = await Promise.all([
    prisma.service.findFirst({
      where:  { id, barbershopId: session.user.barbershopId, deletedAt: null },
      select: { id: true, name: true, description: true, category: true, price: true, durationMin: true },
    }),
    prisma.barbershop.findUnique({
      where:  { id: session.user.barbershopId },
      select: { name: true, city: true, state: true, address: true },
    }),
  ]);

  if (!service) return NextResponse.json({ error: "Serviço não encontrado" }, { status: 404 });

  const categoryPt = CATEGORY_PT[service.category] ?? "serviço";
  const locationParts = [barbershop?.address, barbershop?.city, barbershop?.state].filter(Boolean);
  const location      = locationParts.join(", ") || "Brasil";
  const displayLocation = [barbershop?.city, barbershop?.state].filter(Boolean).join(", ") || "Brasil";
  const descriptionLine = service.description ? `\n- Descrição: ${service.description}` : "";

  const prompt = `Você é um especialista em precificação para barbearias no Brasil. Use busca na web para encontrar preços reais e atuais.

Contexto:
- Barbearia: ${barbershop?.name ?? "não informado"}
- Endereço completo: ${location}
- Serviço: ${service.name} (categoria: ${categoryPt})${descriptionLine}
- Duração: ${service.durationMin} minutos
- Preço atual: R$ ${Number(service.price).toFixed(2)}

PASSO 1 — AVALIAR SE É SERVIÇO COM BENCHMARK:
Analise o nome e a descrição do serviço. Determine se é um serviço comum de barbearia (corte, barba, combo, hidratação, etc.) que tem preços praticados amplamente no mercado, ou se é um serviço exclusivo/inventado pela barbearia (ex: "Ritual do Guerreiro Premium", "Experiência Gold VIP") sem dados de mercado comparáveis.

SE for serviço exclusivo sem benchmark, responda EXCLUSIVAMENTE em JSON:
{
  "isProprietaryService": true,
  "rationale": "Explique em 2 frases por que este serviço não tem benchmark de mercado e que o dono pode precificá-lo livremente baseado no valor percebido pelo cliente."
}

SE for serviço com benchmark, pesquise preços atuais em ${displayLocation} e responda EXCLUSIVAMENTE em JSON:
{
  "isProprietaryService": false,
  "suggestedPrice": 55.00,
  "minPrice": 40.00,
  "maxPrice": 80.00,
  "marketPosition": "médio",
  "rationale": "Explique em 2-3 frases os preços encontrados em ${displayLocation}, mencionando o perfil da região e a faixa de mercado."
}

Responda SOMENTE com o JSON, sem markdown, sem explicações adicionais.`;

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const searchModel = process.env.AI_SEARCH_MODEL ?? "gpt-4o-search-preview";
    const completion = await openai.chat.completions.create({
      model:    searchModel,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    // Strip markdown fences then extract the JSON object (model may add text around it)
    const fenceStripped = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const objectMatch   = fenceStripped.match(/\{[\s\S]*\}/);
    const cleaned       = objectMatch ? objectMatch[0] : fenceStripped;
    const parsed        = JSON.parse(cleaned);

    await consumeAiCredit(session.user.barbershopId, "price_recommend");

    if (parsed.isProprietaryService) {
      return NextResponse.json({
        serviceId:            service.id,
        currentPrice:         Number(service.price),
        isProprietaryService: true,
        rationale:            String(parsed.rationale),
        location:             displayLocation,
      });
    }

    return NextResponse.json({
      serviceId:            service.id,
      currentPrice:         Number(service.price),
      isProprietaryService: false,
      suggestedPrice:       Number(parsed.suggestedPrice),
      minPrice:             Number(parsed.minPrice),
      maxPrice:             Number(parsed.maxPrice),
      marketPosition:       String(parsed.marketPosition),
      rationale:            String(parsed.rationale),
      location:             displayLocation,
    });
  } catch (err) {
    console.error("[recommend-price]", err);
    return NextResponse.json({ error: "Erro ao consultar IA" }, { status: 500 });
  }
}
