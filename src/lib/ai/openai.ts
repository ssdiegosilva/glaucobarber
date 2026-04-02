// ============================================================
// OpenAI – AI Provider Implementation
// ============================================================

import OpenAI from "openai";
import type {
  AIProvider,
  AISuggestionRequest,
  AISuggestion,
  CopilotContext,
  CopilotResponse,
  CopilotActionSuggestion,
} from "./types";

const MODEL = process.env.AI_MODEL ?? "gpt-4o-mini";

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async generateSuggestions(ctx: AISuggestionRequest): Promise<AISuggestion[]> {
    const completion = await this.client.chat.completions.create({
      model: MODEL,
      max_tokens: 1024,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Você é o copiloto de inteligência de uma barbearia premium. Responda sempre em JSON válido.",
        },
        {
          role: "user",
          content: buildSuggestionsPrompt(ctx),
        },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "{}";

    try {
      const parsed = JSON.parse(text);
      // Handle both { suggestions: [...] } and [...] formats
      const arr = Array.isArray(parsed) ? parsed : (parsed.suggestions ?? []);
      return arr;
    } catch {
      return [];
    }
  }

  async generateCampaignText(
    objective: string,
    context: string
  ): Promise<{ text: string; artBriefing: string }> {
    const completion = await this.client.chat.completions.create({
      model: MODEL,
      max_tokens: 512,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Você é especialista em marketing para barbearias premium. Responda em JSON.",
        },
        {
          role: "user",
          content: `Crie um texto de campanha e briefing de arte.\nObjetivo: ${objective}\nContexto: ${context}\n\nRetorne JSON: { "text": "copy da campanha (máx 280 chars)", "artBriefing": "instruções para arte (máx 200 chars)" }`,
        },
      ],
    });

    const raw = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    return { text: raw.text ?? "", artBriefing: raw.artBriefing ?? "" };
  }

  async generateCampaignImage(input: { prompt: string; styleHint?: string }): Promise<{ url: string }> {
    const prompt = `${input.prompt}${input.styleHint ? `\nEstilo: ${input.styleHint}` : ""}`;
    const model = process.env.IMAGE_MODEL ?? "dall-e-3";

    try {
      const img = await this.client.images.generate({
        model,
        prompt,
        size: "1024x1024",
        n: 1,
      });
      const url = img.data?.[0]?.url;
      if (!url) throw new Error("Falha ao gerar imagem");
      return { url };
    } catch (err) {
      throw new Error(`Erro ao gerar imagem (${model}): ${String((err as any)?.message ?? err)}`);
    }
  }

  async generateClientMessage(
    clientName: string,
    daysSinceVisit: number,
    services: string[]
  ): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: MODEL,
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: `Escreva uma mensagem de reativação para cliente de barbearia.\nNome: ${clientName}\nDias sem visitar: ${daysSinceVisit}\nServiços favoritos: ${services.join(", ")}\n\nRegras: informal, simpático, máx 2 frases, inclua CTA para agendar. Retorne apenas o texto.`,
        },
      ],
    });

    return completion.choices[0]?.message?.content ?? "";
  }

  async generateCopilotResponse(context: CopilotContext, question: string): Promise<CopilotResponse> {
    const completion = await this.client.chat.completions.create({
      model: MODEL,
      max_tokens: 800,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Você é o CEO Copilot de uma barbearia premium. Responda curto, em PT-BR, com visão executiva e ações práticas. Nunca execute nada; apenas sugira e peça aprovação. Responda em JSON.",
        },
        {
          role: "user",
          content: buildCopilotPrompt(context, question),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    try {
      const parsed = JSON.parse(raw);
      const actions: CopilotActionSuggestion[] = Array.isArray(parsed.actions) ? parsed.actions : [];
      return {
        answer: parsed.answer ?? "",
        actions,
        requireApproval: parsed.requireApproval !== false,
      };
    } catch {
      return { answer: "Não consegui gerar uma resposta agora.", actions: [], requireApproval: true };
    }
  }
}

function buildSuggestionsPrompt(ctx: AISuggestionRequest): string {
  const postSaleBlock = [
    ctx.clientsAtRisk        > 0 ? `- Clientes em risco (14–60d sem visita): ${ctx.clientsAtRisk}` : null,
    ctx.clientsInactive      > 0 ? `- Clientes inativos (>60d sem visita): ${ctx.clientsInactive}` : null,
    ctx.clientsReactivated   > 0 ? `- Clientes reativados (últimos 60d): ${ctx.clientsReactivated}` : null,
    ctx.pendingGoogleReviews > 0 ? `- Avaliações Google a solicitar (48h pós-atendimento): ${ctx.pendingGoogleReviews}` : null,
  ].filter(Boolean).join("\n");

  return `## Contexto da ${ctx.barbershopName} hoje (${ctx.dayOfWeek}, ${ctx.date})

### Agenda
- Horários totais: ${ctx.totalSlots} | Agendados: ${ctx.bookedSlots} | Livres: ${ctx.freeSlots}
- Ocupação: ${Math.round(ctx.occupancyRate * 100)}%
- Faturamento previsto: R$ ${ctx.revenueToday.toFixed(2)}${ctx.revenueGoal ? ` | Meta mensal: R$ ${ctx.revenueGoal.toFixed(2)}` : ""}
- Serviços populares: ${ctx.topServices.join(", ") || "—"}

### Pós-venda
${postSaleBlock || "- Nenhum alerta de pós-venda no momento"}

### Campanhas
${ctx.recentCampaigns.length > 0 ? `- Ativas/aprovadas: ${ctx.recentCampaigns.join(", ")}` : "- Nenhuma campanha ativa"}

## Tarefa
Gere até 3 sugestões acionáveis e priorizadas para hoje. Considere os alertas de pós-venda (risco, inativos, avaliações) com a mesma importância que a agenda. Priorize o que gera resultado imediato.

Tipos disponíveis:
- COMMERCIAL_INSIGHT: análise ou insight do dia
- CAMPAIGN_TEXT: copy pronto para campanha Instagram/WhatsApp
- CLIENT_MESSAGE: mensagem de reativação para cliente específico em risco ou inativo
- SOCIAL_POST: sugestão de post orgânico
- OFFER_OPPORTUNITY: oportunidade de venda de pacote/serviço

Retorne JSON: { "suggestions": [ { "type": "TIPO", "title": "título (máx 60 chars)", "content": "texto pronto para usar", "reason": "motivo em 1 frase" } ] }`;
}

function buildCopilotPrompt(ctx: CopilotContext, question: string): string {
  const publishedBlock = ctx.publishedCampaigns.length > 0
    ? ctx.publishedCampaigns.map((c) => `  • ${c.title}${c.permalink ? ` → ${c.permalink}` : ""}`).join("\n")
    : "  • Nenhuma publicada ainda";

  return `## Contexto atual da ${ctx.barbershopName}
Data: ${ctx.dayOfWeek}, ${ctx.date}

### Agenda do dia
- Ocupação: ${Math.round(ctx.occupancyRate * 100)}% (${ctx.bookedSlots}/${ctx.totalSlots} horários)
- Horários livres: ${ctx.freeWindows.join(", ") || "—"}
- Receita prevista: R$ ${ctx.projectedRevenue.toFixed(2)} | Realizada: R$ ${ctx.completedRevenue.toFixed(2)}
- Meta mensal: ${ctx.revenueGoal ? `R$ ${ctx.revenueGoal.toFixed(2)}` : "não definida"}
- Meta semanal: ${ctx.weekGoal ? `R$ ${ctx.weekGoal.toFixed(2)} (${ctx.weekProgress ? Math.round(ctx.weekProgress * 100) + "% concluída" : "—"})` : "não definida"}
- Serviços mais vendidos: ${ctx.topServices.join(", ") || "—"}

### Pós-venda
- Clientes em risco (14–60d sem visita, sem agendamento): ${ctx.clientsAtRisk}
- Clientes inativos (>60d sem visita): ${ctx.clientsInactive}
- Clientes reativados (voltaram nos últimos 60d): ${ctx.clientsReactivated}
- Avaliações Google pendentes (48h pós-atendimento): ${ctx.pendingGoogleReviews}

### Campanhas
Ativas/aprovadas: ${ctx.activeCampaigns.join(", ") || "nenhuma"}
Publicadas no Instagram:
${publishedBlock}

---
Pergunta do usuário: ${question}

Responda em JSON:
{
  "answer": "resposta executiva em 2-4 frases",
  "actions": [
    {
      "title": "título da ação",
      "description": "o que fazer exatamente",
      "type": "campaign|post_sale_followup|post_sale_review|agenda|crm|meta|pricing",
      "reason": "por que agir agora",
      "payload": {}
    }
  ],
  "requireApproval": true
}

Tipos de ação disponíveis:
- campaign: criar ou publicar campanha no Instagram/WhatsApp
- post_sale_followup: enviar mensagem de reativação para clientes em risco ou inativos
- post_sale_review: solicitar avaliação Google para clientes recém-atendidos
- agenda: ação relacionada a horários livres ou agendamento
- crm: atualização de dados ou segmentação de clientes
- meta: ajuste de metas de faturamento
- pricing: sugestão de preço ou pacote

Nunca confirme execução. Sempre deixe requireApproval true.`;
}
