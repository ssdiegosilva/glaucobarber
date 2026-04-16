import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { auth } from "@/lib/auth";
import { checkAiAllowance, consumeAiCredit } from "@/lib/billing";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const barbershopId = session.user.barbershopId!;
  const { allowed } = await checkAiAllowance(barbershopId);
  if (!allowed) {
    return NextResponse.json(
      { error: "ai_limit_reached", message: "Limite de IA atingido. Adicione créditos para continuar." },
      { status: 402 }
    );
  }

  const { itemNames, days, hasDiscount, discountPct, productUrl } = await req.json();
  const names: string = Array.isArray(itemNames) ? itemNames.join(", ") : String(itemNames ?? "");
  const link: string | null = typeof productUrl === "string" ? productUrl : null;

  const discountLine = hasDiscount && discountPct
    ? `A oferta inclui ${discountPct}% de desconto exclusivo nos itens: ${names}.`
    : `Não há desconto — é um convite amigável para o cliente voltar.`;

  const linkLine = link
    ? `Inclua este link do produto no final da mensagem para o cliente ver os detalhes: ${link}`
    : "";

  const prompt = [
    `Crie um template de mensagem de WhatsApp curto e amigável (máx 3 parágrafos) para reengajar clientes que não compram há mais de ${days} dias.`,
    `Os itens da oferta são: ${names}.`,
    discountLine,
    linkLine,
    `Use {nome} como placeholder para o nome do cliente.`,
    `Seja direto, acolhedor e convincente. Responda APENAS com o texto da mensagem, sem aspas, sem formatação extra.`,
  ].filter(Boolean).join("\n");

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 400,
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (text) {
      await consumeAiCredit(barbershopId, "copilot_chat");
      return NextResponse.json({ template: text });
    }
    throw new Error("Resposta vazia");
  } catch (err) {
    console.error("[generate-template]", err);
    const linkSuffix = link ? `\n\nVeja mais: ${link}` : "";
    const fallback = `Olá {nome}! 👋\n\nSentimos sua falta! Temos uma oferta especial esperando por você: ${names}${hasDiscount && discountPct ? ` com ${discountPct}% de desconto` : ""}.${linkSuffix}\n\nVenha nos visitar, será um prazer atendê-lo novamente! 😊`;
    return NextResponse.json({ template: fallback });
  }
}
