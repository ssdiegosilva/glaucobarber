import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";
import { getDaysInMonth } from "date-fns";
import { checkAiAllowance, consumeAiCredit } from "@/lib/billing";

const MODEL = process.env.AI_MODEL ?? "gpt-4o-mini";

// ── Regional mapping ──────────────────────────────────────────

const STATE_TO_REGION: Record<string, string> = {
  // Norte
  AC: "Norte", AM: "Norte", AP: "Norte", PA: "Norte", RO: "Norte", RR: "Norte", TO: "Norte",
  // Nordeste
  AL: "Nordeste", BA: "Nordeste", CE: "Nordeste", MA: "Nordeste", PB: "Nordeste",
  PE: "Nordeste", PI: "Nordeste", RN: "Nordeste", SE: "Nordeste",
  // Centro-Oeste
  DF: "Centro-Oeste", GO: "Centro-Oeste", MS: "Centro-Oeste", MT: "Centro-Oeste",
  // Sudeste
  ES: "Sudeste", MG: "Sudeste", RJ: "Sudeste", SP: "Sudeste",
  // Sul
  PR: "Sul", RS: "Sul", SC: "Sul",
};

/**
 * Ticket médio regional — corte simples (R$)
 * Fontes: SEBRAE "Como montar uma barbearia" 2023, Trinks Relatório do Setor 2023
 * Valores representam barbearias convencionais (sem salão premium)
 */
const REGIONAL_TICKET: Record<string, { min: number; avg: number; max: number }> = {
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

/**
 * POST /api/goals/ai-suggest
 * Body: { month, year, offDaysOfWeek, hoursPerDay, appointmentsPerHour, wizardContext? }
 * Returns: { suggestedRevenueTarget, workingDaysCount, avgTicket, region, regionalBenchmark, explanation }
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
  const totalCapacity     = workingDaysCount * Number(hoursPerDay || 8) * Number(appointmentsPerHour || 2);

  // ── Barbershop regional context ───────────────────────────────
  const [barbershop, agg] = await Promise.all([
    prisma.barbershop.findUnique({
      where:  { id: session.user.barbershopId },
      select: { state: true, city: true },
    }),
    prisma.appointment.aggregate({
      where: { barbershopId: session.user.barbershopId, status: "COMPLETED" },
      _avg:  { price: true },
      _count: { _all: true },
    }),
  ]);

  const stateCode = barbershop?.state
    ?.toUpperCase()
    .trim()
    .replace(/^([A-Z]{2}).*/, "$1") ?? null;

  const region    = (stateCode && STATE_TO_REGION[stateCode]) ?? "Sudeste";
  const benchmark = REGIONAL_TICKET[region];

  // Use regional avg as reference; historical only if meaningful (≥20 appointments)
  const historicalTicket = agg._avg.price ? Number(agg._avg.price) : null;
  const hasGoodHistory   = agg._count._all >= 20 && historicalTicket !== null;
  const referenceTicket  = hasGoodHistory
    ? Math.round((benchmark.avg + historicalTicket!) / 2)  // blend 50/50 when history is solid
    : benchmark.avg;

  const DAY_NAMES  = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const offDayNames = offDays.map((d) => DAY_NAMES[d]).join(", ") || "nenhum";

  const prompt = `Você é um consultor financeiro especializado em barbearias brasileiras.

Dados da barbearia:
- Mês de referência: ${month}/${year}
- Estado: ${stateCode ?? "não informado"} — Região: ${region}
- Dias de folga por semana: ${offDayNames}
- Dias úteis no mês: ${workingDaysCount}
- Horas de trabalho por dia: ${hoursPerDay || 8}h
- Atendimentos por hora: ${appointmentsPerHour || 2}
- Capacidade total de atendimentos no mês: ${totalCapacity}

Benchmarks do setor para a região ${region} (SEBRAE/Trinks 2023):
- Ticket médio regional: R$ ${benchmark.min}–${benchmark.max} (média: R$ ${benchmark.avg})
- Ticket de referência para cálculo: R$ ${referenceTicket}${hasGoodHistory ? ` (média entre regional R$ ${benchmark.avg} e histórico R$ ${historicalTicket!.toFixed(0)})` : " (baseado na média regional — histórico insuficiente)"}
- Ocupação típica de barbearias com agenda: 65–75% da capacidade

Com base nesses dados, calcule uma meta de faturamento mensal realista e desafiadora.
Use o ticket de referência (R$ ${referenceTicket}) × capacidade × ocupação esperada de 70%.
Meta estimada base: R$ ${Math.round(totalCapacity * 0.70 * referenceTicket)}
Ajuste conforme o contexto.
${wizardContext ? `\nContexto adicional: "${wizardContext}"` : ""}

Responda SOMENTE em JSON:
{
  "suggestedRevenueTarget": <número inteiro em reais>,
  "explanation": "<2 frases motivadoras em português mencionando os ${workingDaysCount} dias úteis, o ticket regional de R$ ${benchmark.avg} e a meta diária resultante>"
}`;

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.chat.completions.create({
      model:           MODEL,
      max_tokens:      300,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Você é um consultor financeiro de barbearias. Responda sempre em JSON válido." },
        { role: "user",   content: prompt },
      ],
    });

    const text   = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(text);
    await consumeAiCredit(session.user.barbershopId, "goals_suggest");

    return NextResponse.json({
      suggestedRevenueTarget: parsed.suggestedRevenueTarget ?? Math.round(totalCapacity * 0.70 * referenceTicket),
      workingDaysCount,
      region,
      regionalBenchmark: benchmark,
      referenceTicket,
      historicalTicket:  hasGoodHistory ? Math.round(historicalTicket!) : null,
      explanation: parsed.explanation ?? `Com ${workingDaysCount} dias úteis e ticket médio regional de R$ ${benchmark.avg} você pode atingir esta meta.`,
    });
  } catch {
    const suggested = Math.round(totalCapacity * 0.70 * referenceTicket);
    return NextResponse.json({
      suggestedRevenueTarget: suggested,
      workingDaysCount,
      region,
      regionalBenchmark: benchmark,
      referenceTicket,
      historicalTicket:  hasGoodHistory ? Math.round(historicalTicket!) : null,
      explanation: `Com ${workingDaysCount} dias úteis, ticket médio regional de R$ ${benchmark.avg} (${region}) e 70% de ocupação, a meta sugerida é R$ ${suggested.toLocaleString("pt-BR")}.`,
    });
  }
}
