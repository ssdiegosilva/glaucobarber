import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";

export interface HolidayItem {
  day:  number;
  name: string;
  type: "nacional" | "estadual" | "municipal" | "facultativo";
}

function extractJson(text: string): unknown {
  const block = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw   = block ? block[1] : text;
  const match = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

/**
 * GET /api/goals/holidays?month=4&year=2026
 * Returns { holidays: HolidayItem[], cached: boolean }
 * Caches per month/year in PlatformConfig to avoid repeated web searches.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") ?? "0");
  const year  = parseInt(searchParams.get("year")  ?? "0");
  if (!month || !year) return NextResponse.json({ error: "month and year required" }, { status: 400 });

  const cacheKey = `holidays_${year}_${String(month).padStart(2, "0")}`;

  // ── Check cache ────────────────────────────────────────────────
  const cached = await prisma.platformConfig.findUnique({ where: { key: cacheKey } });
  if (cached) {
    try {
      const holidays = JSON.parse(cached.value) as HolidayItem[];
      return NextResponse.json({ holidays, cached: true });
    } catch { /* corrupt cache — re-fetch */ }
  }

  // ── Fetch barbershop state for regional holidays ───────────────
  const barbershop = await prisma.barbershop.findUnique({
    where:  { id: session.user.barbershopId },
    select: { state: true, city: true },
  });
  const state = barbershop?.state?.toUpperCase().trim().slice(0, 2) ?? null;
  const city  = barbershop?.city?.trim() ?? null;

  const MONTH_NAMES_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const monthName = MONTH_NAMES_PT[month - 1];

  const prompt = `Você é um especialista em calendário brasileiro com acesso à internet.

Pesquise TODOS os feriados de ${monthName} de ${year} no Brasil para a localidade:
${city ? `- Cidade: ${city}` : ""}
${state ? `- Estado: ${state}` : ""}
- País: Brasil

Inclua:
1. Feriados nacionais obrigatórios
2. Feriados estaduais de ${state ?? "SP"} (se houver neste mês)
3. Feriados municipais de ${city ?? "São Paulo"} (se houver neste mês)
4. Pontos facultativos federais

Retorne SOMENTE um JSON no formato:
\`\`\`json
{
  "holidays": [
    { "day": <dia do mês como inteiro>, "name": "<nome do feriado>", "type": "nacional" | "estadual" | "municipal" | "facultativo" }
  ]
}
\`\`\`

Se não houver feriados neste mês, retorne {"holidays": []}.`;

  try {
    const client   = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const MODEL    = process.env.AI_MODEL ?? "gpt-4o-mini";

    const response = await (client as any).responses.create({
      model: MODEL,
      tools: [{ type: "web_search_preview" }],
      input: prompt,
    });

    const text: string = typeof response.output_text === "string"
      ? response.output_text
      : response.output?.find((o: any) => o.type === "message")?.content?.find((c: any) => c.type === "output_text")?.text ?? "";

    const parsed = extractJson(text) as any;
    const holidays: HolidayItem[] = Array.isArray(parsed?.holidays)
      ? parsed.holidays.filter((h: any) => typeof h.day === "number" && typeof h.name === "string")
      : [];

    // Cache for 30 days (holidays don't change)
    await prisma.platformConfig.upsert({
      where:  { key: cacheKey },
      update: { value: JSON.stringify(holidays) },
      create: { key: cacheKey, value: JSON.stringify(holidays) },
    });

    return NextResponse.json({ holidays, cached: false });
  } catch {
    // If web search fails, return empty (don't block the user)
    return NextResponse.json({ holidays: [], cached: false });
  }
}
