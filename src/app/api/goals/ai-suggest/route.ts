import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";
import { getDaysInMonth } from "date-fns";
import { checkAiAllowance, consumeAiCredit } from "@/lib/billing";

const MODEL = process.env.AI_MODEL ?? "gpt-4o-mini";

// ── Regional fallback (used only if web search fails) ────────
// Fonte: SEBRAE "Como montar uma barbearia" 2023, Trinks Relatório do Setor 2023

const STATE_TO_REGION: Record<string, string> = {
  AC: "Norte",  AM: "Norte",  AP: "Norte",  PA: "Norte",  RO: "Norte",  RR: "Norte",  TO: "Norte",
  AL: "Nordeste", BA: "Nordeste", CE: "Nordeste", MA: "Nordeste", PB: "Nordeste",
  PE: "Nordeste", PI: "Nordeste", RN: "Nordeste", SE: "Nordeste",
  DF: "Centro-Oeste", GO: "Centro-Oeste", MS: "Centro-Oeste", MT: "Centro-Oeste",
  ES: "Sudeste", MG: "Sudeste", RJ: "Sudeste", SP: "Sudeste",
  PR: "Sul", RS: "Sul", SC: "Sul",
};

const REGIONAL_FALLBACK: Record<string, { min: number; avg: number; max: number }> = {
  Norte:          { min: 25, avg: 40,  max: 80  },
  Nordeste:       { min: 22, avg: 38,  max: 75  },
  "Centro-Oeste": { min: 35, avg: 55,  max: 110 },
  Sudeste:        { min: 40, avg: 70,  max: 150 },
  Sul:            { min: 35, avg: 60,  max: 120 },
};

// ── Helpers ───────────────────────────────────────────────────

function calcWorkingDays(month: number, year: number, offDaysOfWeek: number[]): number {
  const total = getDaysInMonth(new Date(year, month - 1, 1));
  let count = 0;
  for (let d = 1; d <= total; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (!offDaysOfWeek.includes(dow)) count++;
  }
  return count;
}

function extractJson(text: string): Record<string, unknown> | null {
  // Try ```json ... ``` block first, then raw JSON
  const block = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw   = block ? block[1] : text;
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

/**
 * POST /api/goals/ai-suggest
 * Body: { month, year, offDaysOfWeek, hoursPerDay, appointmentsPerHour, wizardContext? }
 * Returns: { suggestedRevenueTarget, workingDaysCount, region, regionalBenchmark,
 *            referenceTicket, historicalTicket, explanation }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed } = await checkAiAllowance(session.user.barbershopId);
  if (!allowed) return NextResponse.json({ error: "ai_limit_reached", message: "Limite de IA atingido. Adicione créditos para continuar.", upgradeUrl: "/billing" }, { status: 402 });

  const { month, year, offDaysOfWeek, hoursPerDay, appointmentsPerHour, wizardContext } = await req.json();
  if (!month || !year) return NextResponse.json({ error: "month e year obrigatórios" }, { status: 400 });

  const offDays: number[] = Array.isArray(offDaysOfWeek) ? offDaysOfWeek.map(Number) : [];
  const workingDaysCount  = calcWorkingDays(Number(month), Number(year), offDays);
  const hours             = Number(hoursPerDay || 8);
  const apptsPerHour      = Number(appointmentsPerHour || 2);
  const totalCapacity     = workingDaysCount * hours * apptsPerHour;

  // ── Barbershop context ────────────────────────────────────────
  const [barbershop, agg] = await Promise.all([
    prisma.barbershop.findUnique({
      where:  { id: session.user.barbershopId },
      select: { state: true, city: true },
    }),
    prisma.appointment.aggregate({
      where:  { barbershopId: session.user.barbershopId, status: "COMPLETED" },
      _avg:   { price: true },
      _count: { _all: true },
    }),
  ]);

  const stateCode      = barbershop?.state?.toUpperCase().trim().replace(/^([A-Z]{2}).*/, "$1") ?? null;
  const city           = barbershop?.city?.trim() ?? null;
  const region         = (stateCode && STATE_TO_REGION[stateCode]) ?? "Sudeste";
  const fallback       = REGIONAL_FALLBACK[region];
  const historicalTicket = agg._avg.price && agg._count._all >= 20 ? Number(agg._avg.price) : null;

  const DAY_NAMES   = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const offDayNames = offDays.map((d) => DAY_NAMES[d]).join(", ") || "nenhum";
  const locationStr = [city, stateCode, `Região ${region}`, "Brasil"].filter(Boolean).join(", ");

  // ── Build prompt for web-search model ────────────────────────
  const searchPrompt = `Você é um consultor financeiro especializado em barbearias brasileiras com acesso à internet.

TAREFA:
1. Busque na internet o ticket médio atual de barbearias na localidade: ${locationStr}
   - Pesquise termos como "ticket médio barbearia ${city ?? stateCode ?? region} 2024 2025" ou "preço corte de cabelo barbearia ${city ?? region}"
   - Foque em fontes como SEBRAE, Trinks, GetNinjas, Habitissimo, ou notícias do setor

2. Com base nos dados encontrados E nos parâmetros abaixo, calcule a meta de faturamento mensal:
   - Localidade: ${locationStr}
   - Mês: ${month}/${year}
   - Dias de folga/semana: ${offDayNames}
   - Dias úteis no mês: ${workingDaysCount}
   - Horas trabalhadas/dia: ${hours}h
   - Atendimentos/hora: ${apptsPerHour}
   - Capacidade total do mês: ${totalCapacity} atendimentos
   ${historicalTicket ? `- Ticket médio histórico desta barbearia: R$ ${historicalTicket.toFixed(2)} (${agg._count._all} atendimentos)` : "- Sem histórico próprio de atendimentos"}
   ${wizardContext ? `- Contexto informado pelo barbeiro: "${wizardContext}"` : ""}

3. Assuma ocupação esperada de 70% da capacidade (padrão do setor).

RESPONDA OBRIGATORIAMENTE no formato JSON abaixo (sem texto antes ou depois):
\`\`\`json
{
  "suggestedRevenueTarget": <número inteiro em reais>,
  "ticketMinFound": <ticket mínimo encontrado na pesquisa, ou null se não encontrou>,
  "ticketAvgFound": <ticket médio encontrado na pesquisa, ou null>,
  "ticketMaxFound": <ticket máximo encontrado na pesquisa, ou null>,
  "ticketSource": "<fonte dos dados ex: 'SEBRAE 2025' ou 'GetNinjas.com.br' ou 'Dados regionais estimados'>",
  "referenceTicket": <ticket usado para o cálculo>,
  "explanation": "<2 frases motivadoras em português sobre os ${workingDaysCount} dias úteis, ticket regional encontrado e meta diária>"
}
\`\`\``;

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // ── Step 1: Responses API with web search (same pattern as generateCampaignThemes) ───
  try {
    const response = await (client as any).responses.create({
      model: MODEL,
      tools: [{ type: "web_search_preview" }],
      input: searchPrompt,
    });

    const text: string = typeof response.output_text === "string"
      ? response.output_text
      : response.output?.find((o: any) => o.type === "message")?.content?.find((c: any) => c.type === "output_text")?.text ?? "";
    const parsed = extractJson(text);

    if (parsed && typeof parsed.suggestedRevenueTarget === "number") {
      await consumeAiCredit(session.user.barbershopId, "goals_suggest");

      const benchmarkFromSearch = (parsed.ticketAvgFound || parsed.ticketMinFound || parsed.ticketMaxFound)
        ? {
            min: Number(parsed.ticketMinFound ?? fallback.min),
            avg: Number(parsed.ticketAvgFound ?? fallback.avg),
            max: Number(parsed.ticketMaxFound ?? fallback.max),
          }
        : fallback;

      return NextResponse.json({
        suggestedRevenueTarget: Math.round(parsed.suggestedRevenueTarget as number),
        workingDaysCount,
        region,
        regionalBenchmark:  benchmarkFromSearch,
        referenceTicket:    Number(parsed.referenceTicket ?? benchmarkFromSearch.avg),
        historicalTicket:   historicalTicket ? Math.round(historicalTicket) : null,
        ticketSource:       parsed.ticketSource ?? "Pesquisa web",
        webSearched:        true,
        explanation: String(parsed.explanation ?? `Com ${workingDaysCount} dias úteis e ticket regional encontrado de R$ ${benchmarkFromSearch.avg} você pode atingir esta meta.`),
      });
    }
    // Parsed but invalid — fall through to step 2
  } catch {
    // web search model unavailable — fall through
  }

  // ── Step 2: fallback — use standard model + regional data ─────
  try {
    const fallbackPrompt = `Você é um consultor financeiro especializado em barbearias brasileiras.

Dados regionais de referência para ${locationStr} (SEBRAE/Trinks 2023):
- Ticket médio regional (${region}): R$ ${fallback.min}–${fallback.max} (média: R$ ${fallback.avg})
${historicalTicket ? `- Ticket histórico desta barbearia: R$ ${historicalTicket.toFixed(2)}` : ""}

Parâmetros da barbearia:
- Mês: ${month}/${year} | Dias úteis: ${workingDaysCount} | Folgas: ${offDayNames}
- Horas/dia: ${hours}h | Atendimentos/hora: ${apptsPerHour} | Capacidade total: ${totalCapacity}
${wizardContext ? `- Contexto: "${wizardContext}"` : ""}

Calcule a meta considerando 70% de ocupação e o ticket médio regional como base.
Responda APENAS em JSON:
{"suggestedRevenueTarget":<inteiro>,"referenceTicket":<inteiro>,"explanation":"<2 frases>"}`;

    const completion = await client.chat.completions.create({
      model:           MODEL,
      max_tokens:      256,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Consultor financeiro de barbearias. Responda em JSON." },
        { role: "user",   content: fallbackPrompt },
      ],
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    await consumeAiCredit(session.user.barbershopId, "goals_suggest");

    return NextResponse.json({
      suggestedRevenueTarget: parsed.suggestedRevenueTarget ?? Math.round(totalCapacity * 0.70 * fallback.avg),
      workingDaysCount,
      region,
      regionalBenchmark: fallback,
      referenceTicket:   parsed.referenceTicket ?? fallback.avg,
      historicalTicket:  historicalTicket ? Math.round(historicalTicket) : null,
      ticketSource:      "SEBRAE / Trinks 2023 (dados regionais)",
      webSearched:       false,
      explanation: parsed.explanation ?? `Com ${workingDaysCount} dias úteis e ticket regional de R$ ${fallback.avg} (${region}), a meta de 70% de ocupação resulta neste valor.`,
    });
  } catch {
    const suggested = Math.round(totalCapacity * 0.70 * fallback.avg);
    return NextResponse.json({
      suggestedRevenueTarget: suggested,
      workingDaysCount,
      region,
      regionalBenchmark: fallback,
      referenceTicket:   fallback.avg,
      historicalTicket:  historicalTicket ? Math.round(historicalTicket) : null,
      ticketSource:      "SEBRAE / Trinks 2023 (dados regionais)",
      webSearched:       false,
      explanation: `Com ${workingDaysCount} dias úteis, ticket médio de R$ ${fallback.avg} (${region}) e 70% de ocupação, a meta estimada é R$ ${suggested.toLocaleString("pt-BR")}.`,
    });
  }
}
