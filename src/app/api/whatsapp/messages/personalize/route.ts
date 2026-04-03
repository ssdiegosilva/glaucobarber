import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkAiAllowance, consumeAiCredit } from "@/lib/billing";
import OpenAI from "openai";

// POST /api/whatsapp/messages/personalize
// Recebe o corpo de um template e o nome do cliente.
// A IA substitui {{name}} e personaliza o tom para soar natural.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const barbershopId = session.user.barbershopId;

  const { allowed } = await checkAiAllowance(barbershopId);
  if (!allowed) return NextResponse.json({ error: "ai_limit_reached" }, { status: 402 });

  const { templateBody, customerName }: { templateBody: string; customerName: string } = await req.json();

  if (!templateBody || !customerName) {
    return NextResponse.json({ error: "templateBody e customerName são obrigatórios" }, { status: 400 });
  }

  // Substituição simples como pré-processamento
  const preProcessed = templateBody.replace(/\{\{name\}\}/gi, customerName);

  const prompt = `Você é o assistente de comunicação de uma barbearia. Personalize a mensagem abaixo para o cliente chamado "${customerName}".
Torne a mensagem mais natural e pessoal, mantendo o tom amigável e profissional de uma barbearia.
Não altere o conteúdo principal — apenas melhore o tom e a naturalidade.
Retorne APENAS o texto da mensagem, sem aspas, sem explicações.

Mensagem base:
${preProcessed}`;

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model  = process.env.AI_MODEL ?? "gpt-4o-mini";

  const completion = await client.chat.completions.create({
    model,
    max_tokens: 400,
    messages: [
      { role: "system", content: "Você escreve mensagens de WhatsApp para barbearias. Responda apenas com o texto da mensagem, sem formatação extra." },
      { role: "user",   content: prompt },
    ],
  });

  const message = completion.choices[0]?.message?.content?.trim() ?? preProcessed;

  await consumeAiCredit(barbershopId, "whatsapp_personalize");

  return NextResponse.json({ message });
}
