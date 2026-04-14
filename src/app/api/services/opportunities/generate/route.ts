import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";
import { checkAiAllowance, consumeAiCredit } from "@/lib/billing";

const CATEGORY_MAP: Record<string, string> = {
  HAIRCUT: "HAIRCUT", BEARD: "BEARD", COMBO: "COMBO",
  TREATMENT: "TREATMENT", OTHER: "OTHER",
  corte: "HAIRCUT", barba: "BEARD", combo: "COMBO",
  tratamento: "TREATMENT",
};

export async function POST() {
  const session = await auth();
  if (!session?.user?.barbershopId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const barbershopId = session.user.barbershopId;

  const { allowed } = await checkAiAllowance(barbershopId);
  if (!allowed) return NextResponse.json({ error: "ai_limit_reached", message: "Limite de IA atingido. Adicione créditos para continuar.", upgradeUrl: "/billing" }, { status: 402 });

  const [barbershop, existingServices] = await Promise.all([
    prisma.barbershop.findUnique({
      where:  { id: barbershopId },
      select: { name: true, address: true, city: true, state: true, segment: { select: { tenantLabel: true, displayName: true } } },
    }),
    prisma.service.findMany({
      where:  { barbershopId, active: true, deletedAt: null },
      select: { name: true },
    }),
  ]);

  const locationParts = [barbershop?.address, barbershop?.city, barbershop?.state].filter(Boolean);
  if (locationParts.length === 0) {
    return NextResponse.json({ error: "ADDRESS_REQUIRED" }, { status: 422 });
  }
  const location = locationParts.join(", ");
  const existingList = existingServices.map((s) => s.name).join(", ");
  const establishmentType = barbershop?.segment?.tenantLabel ?? "barbearia";
  const establishmentDisplay = barbershop?.segment?.displayName ?? "Barbearia";

  const prompt = `Você é especialista em mercado de ${establishmentType}s no Brasil. Use busca na web para encontrar tendências e serviços populares atuais.

${establishmentDisplay}: ${barbershop?.name ?? "sem nome"}
Localização: ${location}
Serviços que já oferece: ${existingList || "nenhum cadastrado"}

Pesquise na internet quais serviços estão em alta em ${establishmentType}s de ${location} atualmente.
Liste 3 serviços POPULARES e com demanda real em ${establishmentType}s de ${location} que este ${establishmentType} ainda NÃO oferece.
Use dados reais do mercado local para sugerir preços precisos e relevantes.
Seja específico, realista e relevante para o mercado local. Não repita nenhum serviço já existente (nem variação do mesmo).

Responda EXCLUSIVAMENTE em JSON sem markdown:
[
  {
    "name": "Nome do serviço",
    "category": "HAIRCUT|BEARD|COMBO|TREATMENT|OTHER",
    "description": "Descrição curta do serviço (1 frase)",
    "suggestedPrice": 50.00,
    "rationale": "Por que este serviço é procurado em ${location} atualmente e qual o preço praticado no mercado local (2 frases)."
  }
]`;

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const searchModel = process.env.AI_SEARCH_MODEL ?? "gpt-4o-search-preview";
    const completion = await openai.chat.completions.create({
      model:    searchModel,
      messages: [{ role: "user", content: prompt }],
    });

    const raw     = completion.choices[0]?.message?.content?.trim() ?? "[]";
    // Strip markdown fences then extract the JSON array (model may add text around it)
    const fenceStripped = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const arrayMatch    = fenceStripped.match(/\[[\s\S]*\]/);
    const cleaned       = arrayMatch ? arrayMatch[0] : fenceStripped;
    const parsed  = JSON.parse(cleaned) as Array<{
      name: string; category: string; description?: string; suggestedPrice: number; rationale: string;
    }>;

    // Filter: reject any whose name is too close to an existing service
    const existingLower = existingServices.map((s) => s.name.toLowerCase());
    const filtered = parsed.filter((opp) => {
      const oppLower = opp.name.toLowerCase();
      return !existingLower.some((existing) =>
        existing.includes(oppLower) || oppLower.includes(existing)
      );
    });

    // Delete old PENDING opportunities for this barbershop before inserting new ones
    await prisma.serviceOpportunity.deleteMany({
      where: { barbershopId, status: "PENDING" },
    });

    const created = await prisma.$transaction(
      filtered.map((opp) =>
        prisma.serviceOpportunity.create({
          data: {
            barbershopId,
            name:          opp.name,
            category:      (CATEGORY_MAP[opp.category] ?? "OTHER") as never,
            description:   opp.description ?? null,
            suggestedPrice: opp.suggestedPrice,
            rationale:     opp.rationale,
          },
        })
      )
    );

    await consumeAiCredit(barbershopId, "opportunities");
    return NextResponse.json({ opportunities: created });
  } catch (err) {
    console.error("[opportunities/generate]", err);
    return NextResponse.json({ error: "Erro ao gerar sugestões" }, { status: 500 });
  }
}
