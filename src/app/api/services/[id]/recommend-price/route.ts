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
  // Build location from most specific to least: address → city/state → Brasil
  const locationParts = [barbershop?.address, barbershop?.city, barbershop?.state].filter(Boolean);
  const location      = locationParts.join(", ") || "Brasil";
  // Neighborhood/city display for UI
  const displayLocation = [barbershop?.city, barbershop?.state].filter(Boolean).join(", ") || "Brasil";

  const prompt = `Você é um especialista em precificação para barbearias no Brasil.

Contexto:
- Barbearia: ${barbershop?.name ?? "não informado"}
- Endereço completo: ${location}
- Serviço: ${service.name} (categoria: ${categoryPt})
- Duração: ${service.durationMin} minutos
- Preço atual: R$ ${Number(service.price).toFixed(2)}

Pesquise e analise o mercado de barbearias especificamente em ${displayLocation} e sugira um preço ideal para este serviço.
Use o endereço completo para considerar o perfil socioeconômico da região e a concorrência local.
Considere:
1. Faixa de preço praticada por barbearias na região de ${displayLocation}
2. Posicionamento de mercado (entrada, médio, premium) neste bairro/cidade
3. Custo de tempo (${service.durationMin} min)

Responda EXCLUSIVAMENTE em JSON com este formato (sem markdown):
{
  "suggestedPrice": 55.00,
  "minPrice": 40.00,
  "maxPrice": 80.00,
  "marketPosition": "médio",
  "rationale": "Explicação em 2-3 frases mencionando explicitamente ${displayLocation} e os preços praticados na região."
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
      serviceId:       service.id,
      currentPrice:    Number(service.price),
      suggestedPrice:  Number(parsed.suggestedPrice),
      minPrice:        Number(parsed.minPrice),
      maxPrice:        Number(parsed.maxPrice),
      marketPosition:  String(parsed.marketPosition),
      rationale:       String(parsed.rationale),
      location:        displayLocation,
    });
  } catch (err) {
    console.error("[recommend-price]", err);
    return NextResponse.json({ error: "Erro ao consultar IA" }, { status: 500 });
  }
}
