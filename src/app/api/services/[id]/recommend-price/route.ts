import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

  const { id } = await params;

  const [service, barbershop] = await Promise.all([
    prisma.service.findFirst({
      where:  { id, barbershopId: session.user.barbershopId },
      select: { id: true, name: true, category: true, price: true, durationMin: true },
    }),
    prisma.barbershop.findUnique({
      where:  { id: session.user.barbershopId },
      select: { name: true, city: true, state: true, address: true },
    }),
  ]);

  if (!service) return NextResponse.json({ error: "Serviço não encontrado" }, { status: 404 });

  const categoryPt = CATEGORY_PT[service.category] ?? "serviço";
  const location   = [barbershop?.city, barbershop?.state].filter(Boolean).join(", ") || "Brasil";

  const prompt = `Você é um especialista em precificação para barbearias no Brasil.

Contexto:
- Barbearia: ${barbershop?.name ?? "não informado"}
- Localização: ${location}
- Serviço: ${service.name} (categoria: ${categoryPt})
- Duração: ${service.durationMin} minutos
- Preço atual: R$ ${Number(service.price).toFixed(2)}

Analise o mercado de barbearias em ${location} e sugira um preço ideal para este serviço, considerando:
1. Faixa de preço típica para ${categoryPt} em ${location}
2. Posicionamento de mercado (entrada, médio, premium)
3. Custo de tempo (${service.durationMin} min)

Responda EXCLUSIVAMENTE em JSON com este formato (sem markdown):
{
  "suggestedPrice": 55.00,
  "minPrice": 40.00,
  "maxPrice": 80.00,
  "marketPosition": "médio",
  "rationale": "Explicação em 2-3 frases em português sobre o preço sugerido e o mercado local."
}`;

  try {
    const completion = await openai.chat.completions.create({
      model:       process.env.AI_MODEL ?? "gpt-4o-mini",
      messages:    [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens:  300,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    // Strip possible ```json fences
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed  = JSON.parse(cleaned);

    return NextResponse.json({
      serviceId:      service.id,
      currentPrice:   Number(service.price),
      suggestedPrice: Number(parsed.suggestedPrice),
      minPrice:       Number(parsed.minPrice),
      maxPrice:       Number(parsed.maxPrice),
      marketPosition: String(parsed.marketPosition),
      rationale:      String(parsed.rationale),
    });
  } catch (err) {
    console.error("[recommend-price]", err);
    return NextResponse.json({ error: "Erro ao consultar IA" }, { status: 500 });
  }
}
