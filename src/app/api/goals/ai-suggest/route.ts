import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";
import { getDaysInMonth } from "date-fns";
import { checkAiAllowance, consumeAiCredit } from "@/lib/billing";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL  = process.env.AI_MODEL ?? "gpt-4o-mini";

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
 * Body: { month, year, offDaysOfWeek, hoursPerDay, appointmentsPerHour }
 * Returns: { suggestedRevenueTarget, workingDaysCount, explanation }
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

  // Get historical avg ticket for this barbershop
  const agg = await prisma.appointment.aggregate({
    where:  { barbershopId: session.user.barbershopId, status: "COMPLETED" },
    _avg:   { price: true },
    _count: { _all: true },
  });
  const avgTicket = agg._avg.price ? Number(agg._avg.price) : 80;
  const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const offDayNames = offDays.map((d) => DAY_NAMES[d]).join(", ") || "nenhum";

  const prompt = `Você é um consultor financeiro especializado em barbearias.
Dados da barbearia:
- Mês de referência: ${month}/${year}
- Dias de folga por semana: ${offDayNames}
- Dias úteis no mês: ${workingDaysCount}
- Horas de trabalho por dia: ${hoursPerDay || 8}h
- Atendimentos por hora: ${appointmentsPerHour || 2}
- Capacidade total de atendimentos no mês: ${totalCapacity}
- Ticket médio histórico: R$ ${avgTicket.toFixed(2)}

Com base nesses dados, sugira uma meta de faturamento mensal realista mas desafiadora.
Considere uma ocupação esperada entre 70% e 85% da capacidade total.
${wizardContext ? `\nContexto adicional informado pelo barbeiro: "${wizardContext}"\nConsidere este contexto ao ajustar a meta (ex: feriados, eventos especiais, folgas extras).` : ""}

Responda SOMENTE em JSON com exatamente esse formato:
{
  "suggestedRevenueTarget": <número em reais, sem casas decimais>,
  "explanation": "<explicação em 2 frases motivadoras em português, mencionando os ${workingDaysCount} dias úteis e a meta diária resultante>"
}`;

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 256,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Você é um consultor financeiro de barbearias. Responda sempre em JSON válido." },
        { role: "user", content: prompt },
      ],
    });

    const text   = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(text);
    await consumeAiCredit(session.user.barbershopId);

    return NextResponse.json({
      suggestedRevenueTarget: parsed.suggestedRevenueTarget ?? Math.round(totalCapacity * 0.75 * avgTicket),
      workingDaysCount,
      avgTicket,
      explanation: parsed.explanation ?? `Com ${workingDaysCount} dias úteis você tem capacidade para ${totalCapacity} atendimentos.`,
    });
  } catch {
    // Fallback calculation if AI fails
    const suggested = Math.round(totalCapacity * 0.75 * avgTicket);
    return NextResponse.json({
      suggestedRevenueTarget: suggested,
      workingDaysCount,
      avgTicket,
      explanation: `Com ${workingDaysCount} dias úteis e ${totalCapacity} atendimentos possíveis, a meta sugerida considera 75% de ocupação.`,
    });
  }
}
