import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkAiAllowance, consumeAiCredit } from "@/lib/billing";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// POST /api/products/analyze
// Accepts { name?: string, imageUrl?: string } and returns AI-suggested category + description
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const barbershopId = session.user.barbershopId;
  const { allowed } = await checkAiAllowance(barbershopId);
  if (!allowed) {
    return NextResponse.json({ error: "ai_limit_reached", message: "Limite de IA atingido." }, { status: 402 });
  }

  const { name, imageUrl } = await req.json();
  if (!name && !imageUrl) {
    return NextResponse.json({ error: "Nome ou foto é obrigatório" }, { status: 400 });
  }

  const prompt = `Analise este produto e retorne um JSON com os campos:
- "name": nome do produto (se já fornecido, mantenha; se veio da foto, identifique)
- "category": categoria do produto (ex: "Cabelo", "Barba", "Skincare", "Acessórios", "Bebidas", "Alimentos", etc.)
- "description": descrição curta e atrativa do produto (máx 2 frases, para catálogo)

${name ? `Nome fornecido: "${name}"` : "Identifique o produto pela foto."}

Responda APENAS com o JSON, sem markdown, sem código.`;

  try {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    if (imageUrl) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
        ],
      });
    } else {
      messages.push({ role: "user", content: prompt });
    }

    const completion = await openai.chat.completions.create({
      model: imageUrl ? "gpt-4o" : "gpt-4o-mini",
      messages,
      max_tokens: 300,
      response_format: { type: "json_object" },
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) throw new Error("Resposta vazia");

    await consumeAiCredit(barbershopId, "copilot_chat");

    const parsed = JSON.parse(text);
    return NextResponse.json({
      name: parsed.name ?? name ?? "",
      category: parsed.category ?? "",
      description: parsed.description ?? "",
    });
  } catch (err) {
    console.error("[products/analyze]", err);
    return NextResponse.json({
      name: name ?? "",
      category: "",
      description: "",
      error: "Não foi possível analisar. Preencha manualmente.",
    });
  }
}
