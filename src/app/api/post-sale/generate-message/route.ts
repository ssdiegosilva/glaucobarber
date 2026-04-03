import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";
import { checkAiAllowance, consumeAiCredit } from "@/lib/billing";

const MODEL = process.env.AI_MODEL ?? "gpt-4o-mini";

const TYPE_PROMPTS: Record<string, (name: string, days: number, service: string, barbershop: string) => string> = {
  post_sale_review: (name, _days, service, barbershop) =>
    `Escreva uma mensagem de WhatsApp pedindo avaliação Google para o cliente ${name} que acabou de ser atendido na barbearia ${barbershop} com o serviço "${service}". Tom: simpático, informal, curto (1-2 frases). Inclua um CTA para avaliar. Retorne apenas o texto da mensagem.`,

  reactivation: (name, days, service, barbershop) =>
    `Escreva uma mensagem de reativação de WhatsApp para o cliente ${name} da barbearia ${barbershop} que está há ${days} dias sem visitar. Último serviço: "${service}". Tom: amigável, sem pressão, curto (2-3 frases). Inclua CTA para agendar. Retorne apenas o texto.`,

  reactivation_promo: (name, days, service, barbershop) =>
    `Escreva uma mensagem de WhatsApp com oferta especial para reativar o cliente ${name} da barbearia ${barbershop}, ausente há ${days} dias. Último serviço: "${service}". Mencione desconto ou benefício (genérico). Tom: entusiasmado mas não invasivo. Curto (2-3 frases). Retorne apenas o texto.`,

  post_sale_followup: (name, days, _service, barbershop) =>
    `Escreva uma mensagem de acompanhamento de WhatsApp para o cliente ${name} da barbearia ${barbershop}, ausente há ${days} dias. Tom: próximo, informal, personalizado. Curto (2 frases). Inclua CTA para agendar. Retorne apenas o texto.`,
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed } = await checkAiAllowance(session.user.barbershopId);
  if (!allowed) return NextResponse.json({ error: "ai_limit_reached", message: "Limite de IA atingido. Adicione créditos para continuar.", upgradeUrl: "/billing" }, { status: 402 });

  const { customerId, type } = await req.json();
  if (!customerId || !type) return NextResponse.json({ error: "customerId e type são obrigatórios" }, { status: 400 });

  const [customer, barbershop] = await Promise.all([
    prisma.customer.findFirst({
      where:  { id: customerId, barbershopId: session.user.barbershopId },
      select: {
        name: true,
        lastCompletedAppointmentAt: true,
        appointments: {
          where:   { status: "COMPLETED" },
          orderBy: { completedAt: "desc" },
          take:    1,
          select:  { service: { select: { name: true } } },
        },
      },
    }),
    prisma.barbershop.findUnique({
      where:  { id: session.user.barbershopId },
      select: { name: true },
    }),
  ]);

  if (!customer) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  const days        = customer.lastCompletedAppointmentAt
    ? Math.floor((Date.now() - customer.lastCompletedAppointmentAt.getTime()) / 86_400_000)
    : 0;
  const serviceName = customer.appointments[0]?.service?.name ?? "corte";
  const shopName    = barbershop?.name ?? "barbearia";

  const promptFn = TYPE_PROMPTS[type] ?? TYPE_PROMPTS.post_sale_followup;
  const prompt   = promptFn(customer.name, days, serviceName, shopName);

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model:      MODEL,
      max_tokens: 200,
      messages:   [{ role: "user", content: prompt }],
    });
    const message = completion.choices[0]?.message?.content?.trim() ?? "";
    await consumeAiCredit(session.user.barbershopId, "post_sale");
    return NextResponse.json({ message });
  } catch {
    return NextResponse.json({ error: "Erro ao gerar mensagem" }, { status: 500 });
  }
}
