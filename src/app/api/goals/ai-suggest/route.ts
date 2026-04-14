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

function calcWorkingDays(month: number, year: number, offDaysOfWeek: number[], holidayDays: number[] = []): number {
  const total = getDaysInMonth(new Date(year, month - 1, 1));
  let count = 0;
  for (let d = 1; d <= total; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (!offDaysOfWeek.includes(dow) && !holidayDays.includes(d)) count++;
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

  // ── Load cached holidays (if any) ────────────────────────────
  const cacheKey     = `holidays_${year}_${String(month).padStart(2, "0")}`;
  const cachedHols   = await prisma.platformConfig.findUnique({ where: { key: cacheKey } });
  type CachedHol = { day: number; name: string; type: string };
  const cachedHolidays: CachedHol[] = cachedHols ? (() => { try { return JSON.parse(cachedHols.value); } catch { return []; } })() : [];
  const cachedHolidayDays = cachedHolidays.map((h) => h.day);

  const workingDaysCount = calcWorkingDays(Number(month), Number(year), offDays, cachedHolidayDays);
  const hours             = Number(hoursPerDay || 8);
  const apptsPerHour      = Number(appointmentsPerHour || 2);
  const totalCapacity     = workingDaysCount * hours * apptsPerHour;

  // ── Barbershop context ────────────────────────────────────────
  // Last 3 months for expense history
  const now3m    = new Date();
  const months3: { month: number; year: number }[] = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now3m.getFullYear(), now3m.getMonth() - i, 1);
    months3.push({ month: d.getMonth() + 1, year: d.getFullYear() });
  }

  const [barbershop, agg, expenseHistory] = await Promise.all([
    prisma.barbershop.findUnique({
      where:  { id: session.user.barbershopId },
      select: { state: true, city: true, segment: { select: { tenantLabel: true, displayName: true } } },
    }),
    prisma.appointment.aggregate({
      where:  { barbershopId: session.user.barbershopId, status: "COMPLETED" },
      _avg:   { price: true },
      _count: { _all: true },
    }),
    prisma.expense.findMany({
      where: {
        barbershopId: session.user.barbershopId,
        OR: months3.map(({ month, year }) => ({ month, year })),
      },
      select: { label: true, amountCents: true, month: true, year: true },
    }),
  ]);

  // Group expenses by month and calculate average
  const expenseByMonth: Record<string, number> = {};
  for (const e of expenseHistory) {
    const key = `${e.year}-${String(e.month).padStart(2, "0")}`;
    expenseByMonth[key] = (expenseByMonth[key] ?? 0) + e.amountCents / 100;
  }
  const expenseMonthsWithData = Object.values(expenseByMonth);
  const avgMonthlyExpenses    = expenseMonthsWithData.length > 0
    ? expenseMonthsWithData.reduce((s, v) => s + v, 0) / expenseMonthsWithData.length
    : null;

  // Aggregate by label across all months for top costs
  const expenseLabelMap: Record<string, number> = {};
  for (const e of expenseHistory) {
    expenseLabelMap[e.label] = (expenseLabelMap[e.label] ?? 0) + e.amountCents / 100;
  }
  const topExpenses = Object.entries(expenseLabelMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, total]) => `${label}: R$ ${(total / expenseMonthsWithData.length || 1).toFixed(0)}/mês`);

  const stateCode      = barbershop?.state?.toUpperCase().trim().replace(/^([A-Z]{2}).*/, "$1") ?? null;
  const city           = barbershop?.city?.trim() ?? null;
  const establishmentType = barbershop?.segment?.tenantLabel ?? "barbearia";
  const region         = (stateCode && STATE_TO_REGION[stateCode]) ?? "Sudeste";
  const fallback       = REGIONAL_FALLBACK[region];
  const historicalTicket = agg._avg.price && agg._count._all >= 20 ? Number(agg._avg.price) : null;

  const DAY_NAMES   = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const offDayNames = offDays.map((d) => DAY_NAMES[d]).join(", ") || "nenhum";
  const locationStr = [city, stateCode, `Região ${region}`, "Brasil"].filter(Boolean).join(", ");

  const MONTH_NAMES_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const monthName = MONTH_NAMES_PT[Number(month) - 1];

  // ── Build prompt for web-search model ────────────────────────
  const searchPrompt = `Você é um consultor financeiro especializado em ${establishmentType}s brasileiros com acesso à internet.

TAREFA — faça as duas pesquisas abaixo em paralelo:

1. FERIADOS: Busque todos os feriados de ${monthName}/${year} para ${locationStr}.
   Inclua: feriados nacionais, estaduais de ${stateCode ?? "SP"}, municipais de ${city ?? "São Paulo"} e pontos facultativos.
   ${cachedHolidays.length > 0 ? `(Já temos estes feriados cacheados: ${cachedHolidays.map((h) => `dia ${h.day} - ${h.name}`).join(", ")})` : ""}

2. TICKET MÉDIO: Busque o ticket médio atual de ${establishmentType}s em ${locationStr}.
   Pesquise: "ticket médio ${establishmentType} ${city ?? stateCode ?? region} 2024 2025", "preço serviço ${establishmentType} ${city ?? region}".
   Fontes: SEBRAE, GetNinjas, Habitissimo.

Com base nos dados, calcule a meta de faturamento mensal:
- Localidade: ${locationStr}
- Mês: ${monthName}/${year}
- Dias de folga/semana: ${offDayNames}
- Dias úteis (excluindo folgas e feriados que caem em dias úteis): ${workingDaysCount}
- Horas/dia: ${hours}h | Atendimentos/hora: ${apptsPerHour} | Capacidade: ${totalCapacity}
${historicalTicket ? `- Ticket histórico da barbearia: R$ ${historicalTicket.toFixed(2)} (${agg._count._all} atend.)` : "- Sem histórico de atendimentos"}
${avgMonthlyExpenses ? `- Custos mensais médios: R$ ${avgMonthlyExpenses.toFixed(0)} (${topExpenses.join(" | ")})` : "- Sem custos cadastrados"}
${wizardContext ? `- Contexto do barbeiro: "${wizardContext}"` : ""}

Regras:
- Ocupação esperada: 70% da capacidade
- Se há custos cadastrados: meta mínima = custos × 1,30 (30% de margem)

RESPONDA OBRIGATORIAMENTE no formato JSON abaixo (sem texto antes ou depois):
\`\`\`json
{
  "suggestedRevenueTarget": <número inteiro em reais>,
  "workingDaysActual": <dias úteis reais após descontar feriados que caem em dias de trabalho>,
  "holidays": [{ "day": <dia do mês>, "name": "<nome>", "type": "nacional|estadual|municipal|facultativo" }],
  "ticketMinFound": <ou null>,
  "ticketAvgFound": <ou null>,
  "ticketMaxFound": <ou null>,
  "ticketSource": "<fonte>",
  "referenceTicket": <ticket usado no cálculo>,
  "explanation": "<2 frases motivadoras mencionando dias úteis reais, feriados do mês e meta diária>"
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

    if (parsed && typeof parsed.suggestedRevenueTarget === "number" && parsed.suggestedRevenueTarget > 0) {
      await consumeAiCredit(session.user.barbershopId, "goals_suggest");

      // Save holidays to cache if returned
      const returnedHolidays: CachedHol[] = Array.isArray(parsed.holidays)
        ? (parsed.holidays as any[]).filter((h) => typeof h.day === "number" && typeof h.name === "string")
        : cachedHolidays;

      if (returnedHolidays.length > 0) {
        await prisma.platformConfig.upsert({
          where:  { key: cacheKey },
          update: { value: JSON.stringify(returnedHolidays) },
          create: { key: cacheKey, value: JSON.stringify(returnedHolidays) },
        });
      }

      const actualWorkingDays = typeof parsed.workingDaysActual === "number"
        ? Number(parsed.workingDaysActual)
        : workingDaysCount;

      const benchmarkFromSearch = (parsed.ticketAvgFound || parsed.ticketMinFound || parsed.ticketMaxFound)
        ? {
            min: Number(parsed.ticketMinFound ?? fallback.min),
            avg: Number(parsed.ticketAvgFound ?? fallback.avg),
            max: Number(parsed.ticketMaxFound ?? fallback.max),
          }
        : fallback;

      return NextResponse.json({
        suggestedRevenueTarget: Math.round(parsed.suggestedRevenueTarget as number),
        workingDaysCount:       actualWorkingDays,
        holidays:               returnedHolidays,
        region,
        regionalBenchmark:      benchmarkFromSearch,
        referenceTicket:        Number(parsed.referenceTicket ?? benchmarkFromSearch.avg),
        historicalTicket:       historicalTicket ? Math.round(historicalTicket) : null,
        avgMonthlyExpenses:     avgMonthlyExpenses ? Math.round(avgMonthlyExpenses) : null,
        ticketSource:           parsed.ticketSource ?? "Pesquisa web",
        webSearched:            true,
        explanation: String(parsed.explanation ?? `Com ${actualWorkingDays} dias úteis e ticket regional encontrado de R$ ${benchmarkFromSearch.avg} você pode atingir esta meta.`),
      });
    }
    // Parsed but invalid — fall through to step 2
  } catch {
    // web search model unavailable — fall through
  }

  // ── Step 2: fallback — use standard model + regional data ─────
  try {
    const fallbackPrompt = `Você é um consultor financeiro especializado em ${establishmentType}s brasileiros.

Dados regionais de referência para ${locationStr} (SEBRAE 2023):
- Ticket médio regional (${region}): R$ ${fallback.min}–${fallback.max} (média: R$ ${fallback.avg})
${historicalTicket ? `- Ticket histórico desta barbearia: R$ ${historicalTicket.toFixed(2)}` : ""}

Parâmetros da barbearia:
- Mês: ${month}/${year} | Dias úteis: ${workingDaysCount} | Folgas: ${offDayNames}
- Horas/dia: ${hours}h | Atendimentos/hora: ${apptsPerHour} | Capacidade total: ${totalCapacity}
${avgMonthlyExpenses ? `- Custos mensais médios: R$ ${avgMonthlyExpenses.toFixed(0)} (${topExpenses.join(" | ")})` : "- Sem custos cadastrados"}
${wizardContext ? `- Contexto: "${wizardContext}"` : ""}

Calcule a meta considerando 70% de ocupação e o ticket médio regional como base.
${avgMonthlyExpenses ? `A meta deve cobrir os custos mensais (R$ ${avgMonthlyExpenses.toFixed(0)}) com pelo menos 30% de margem de lucro.` : ""}
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
      suggestedRevenueTarget: parsed.suggestedRevenueTarget || Math.round(totalCapacity * 0.70 * fallback.avg),
      workingDaysCount,
      holidays:          cachedHolidays,
      region,
      regionalBenchmark: fallback,
      referenceTicket:   parsed.referenceTicket ?? fallback.avg,
      historicalTicket:    historicalTicket ? Math.round(historicalTicket) : null,
      avgMonthlyExpenses:  avgMonthlyExpenses ? Math.round(avgMonthlyExpenses) : null,
      ticketSource:        "SEBRAE / Trinks 2023 (dados regionais)",
      webSearched:         false,
      explanation: parsed.explanation ?? `Com ${workingDaysCount} dias úteis e ticket regional de R$ ${fallback.avg} (${region}), a meta de 70% de ocupação resulta neste valor.`,
    });
  } catch {
    const suggested = Math.round(totalCapacity * 0.70 * fallback.avg);
    return NextResponse.json({
      suggestedRevenueTarget: suggested,
      workingDaysCount,
      holidays:          cachedHolidays,
      region,
      regionalBenchmark: fallback,
      referenceTicket:   fallback.avg,
      historicalTicket:    historicalTicket ? Math.round(historicalTicket) : null,
      avgMonthlyExpenses:  avgMonthlyExpenses ? Math.round(avgMonthlyExpenses) : null,
      ticketSource:        "SEBRAE / Trinks 2023 (dados regionais)",
      webSearched:         false,
      explanation: `Com ${workingDaysCount} dias úteis, ticket médio de R$ ${fallback.avg} (${region}) e 70% de ocupação, a meta estimada é R$ ${suggested.toLocaleString("pt-BR")}.`,
    });
  }
}
