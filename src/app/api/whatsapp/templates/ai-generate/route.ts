import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkAiAllowance, consumeAiCredit } from "@/lib/billing";
import OpenAI from "openai";

const ACTION_LABELS: Record<string, string> = {
  post_sale:    "pós-venda (acompanhamento após atendimento)",
  reactivation: "reativação de cliente inativo",
  promotion:    "promoção ou oferta especial",
  review:       "solicitação de avaliação Google",
  followup:     "acompanhamento geral / fidelização",
};

// POST /api/whatsapp/templates/ai-generate
// Gera o corpo de um template de texto via IA dado o tipo de ação.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const barbershopId = session.user.barbershopId;

  const { allowed } = await checkAiAllowance(barbershopId);
  if (!allowed) return NextResponse.json({ error: "ai_limit_reached" }, { status: 402 });

  const { actionType, context: extraContext }: { actionType: string; context?: string } = await req.json();

  if (!actionType || !ACTION_LABELS[actionType]) {
    return NextResponse.json({ error: "actionType inválido" }, { status: 400 });
  }

  const barbershop = await prisma.barbershop.findUnique({
    where:  { id: barbershopId },
    select: { name: true },
  });

  const actionLabel = ACTION_LABELS[actionType];
  const shopName    = barbershop?.name ?? "nossa barbearia";

  const prompt = `Crie uma mensagem de WhatsApp para uma barbearia chamada "${shopName}" com o objetivo de: ${actionLabel}.

Regras obrigatórias:
- Use {{name}} exatamente onde o nome do cliente deve aparecer (ex: "Olá, {{name}}!")
- Mensagem curta e amigável (máximo 3 parágrafos)
- Tom informal mas profissional, adequado a uma barbearia
- Não use asteriscos nem formatação markdown
- Termine com assinatura da barbearia: "Equipe ${shopName}"
${extraContext ? `\nContexto adicional: ${extraContext}` : ""}

Retorne JSON no formato: {"label": "Nome curto do template (máximo 5 palavras)", "body": "Corpo completo da mensagem"}`;

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model  = process.env.AI_MODEL ?? "gpt-4o-mini";

  const completion = await client.chat.completions.create({
    model,
    max_tokens: 512,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "Você é especialista em comunicação de barbearias. Responda sempre em JSON válido com os campos label e body." },
      { role: "user",   content: prompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let result: { label?: string; body?: string };
  try { result = JSON.parse(raw); } catch { result = {}; }

  if (!result.label || !result.body) {
    return NextResponse.json({ error: "IA não retornou um template válido" }, { status: 500 });
  }

  await consumeAiCredit(barbershopId, "whatsapp_template");

  return NextResponse.json({ label: result.label, body: result.body });
}
