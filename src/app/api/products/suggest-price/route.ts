import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkAiAllowance, consumeAiCredit } from "@/lib/billing";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// POST /api/products/suggest-price
// Uses OpenAI Responses API with web_search to find real prices online
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const barbershopId = session.user.barbershopId;
  const { allowed } = await checkAiAllowance(barbershopId);
  if (!allowed) {
    return NextResponse.json({ error: "ai_limit_reached", message: "Limite de IA atingido." }, { status: 402 });
  }

  const { name, category, description } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Nome do produto é obrigatório" }, { status: 400 });
  }

  const prompt = `Busque o preço real deste produto no mercado brasileiro:

Produto: "${name}"
${category ? `Categoria: ${category}` : ""}
${description ? `Descrição: ${description}` : ""}

Pesquise em Mercado Livre, Amazon Brasil, farmácias e lojas especializadas.

Retorne APENAS um JSON (sem markdown, sem \`\`\`) com:
- "minPrice": menor preço encontrado (número em BRL)
- "maxPrice": maior preço encontrado (número em BRL)
- "suggestedPrice": preço sugerido para revenda com margem (número em BRL)
- "source": sites onde encontrou os preços
- "note": observação curta sobre a faixa de preço (1 frase em português)`;

  try {
    // Use Responses API with web_search tool for real-time pricing
    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      tools: [{ type: "web_search_preview" }],
      input: prompt,
    });

    // Extract text from response
    const text = response.output
      .filter((item): item is OpenAI.Responses.ResponseOutputMessage => item.type === "message")
      .flatMap((msg) => msg.content)
      .filter((c): c is OpenAI.Responses.ResponseOutputText => c.type === "output_text")
      .map((c) => c.text)
      .join("");

    if (!text) throw new Error("Resposta vazia");

    await consumeAiCredit(barbershopId, "copilot_chat");

    // Clean and parse JSON (remove markdown fences if present)
    const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json({
      minPrice: Number(parsed.minPrice) || 0,
      maxPrice: Number(parsed.maxPrice) || 0,
      suggestedPrice: Number(parsed.suggestedPrice) || 0,
      source: parsed.source ?? "",
      note: parsed.note ?? "",
    });
  } catch (err) {
    console.error("[products/suggest-price]", err);

    // Fallback: try without web search
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt + "\n\nSe não tiver dados reais, estime baseado no seu conhecimento." }],
        max_tokens: 300,
        response_format: { type: "json_object" },
      });
      const fallbackText = completion.choices[0]?.message?.content?.trim();
      if (fallbackText) {
        await consumeAiCredit(barbershopId, "copilot_chat");
        const parsed = JSON.parse(fallbackText);
        return NextResponse.json({
          minPrice: Number(parsed.minPrice) || 0,
          maxPrice: Number(parsed.maxPrice) || 0,
          suggestedPrice: Number(parsed.suggestedPrice) || 0,
          source: parsed.source ?? "Estimativa IA",
          note: parsed.note ?? "",
        });
      }
    } catch { /* ignore fallback error */ }

    return NextResponse.json({ error: "Não foi possível buscar o preço." }, { status: 500 });
  }
}
