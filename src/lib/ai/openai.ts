// ============================================================
// OpenAI – AI Provider Implementation
// ============================================================

import OpenAI from "openai";
import type { AIProvider, AISuggestionRequest, AISuggestion } from "./types";

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
}

function buildSuggestionsPrompt(ctx: AISuggestionRequest): string {
  return `## Contexto da ${ctx.barbershopName} hoje (${ctx.dayOfWeek}, ${ctx.date})
- Horários totais: ${ctx.totalSlots}
- Agendados: ${ctx.bookedSlots} | Livres: ${ctx.freeSlots}
- Ocupação: ${Math.round(ctx.occupancyRate * 100)}%
- Faturamento previsto: R$ ${ctx.revenueToday.toFixed(2)}
${ctx.revenueGoal ? `- Meta mensal: R$ ${ctx.revenueGoal.toFixed(2)}` : ""}
- Serviços populares: ${ctx.topServices.join(", ") || "—"}
- Clientes inativos >30 dias: ${ctx.inactiveClients}
${ctx.recentCampaigns.length > 0 ? `- Campanhas recentes: ${ctx.recentCampaigns.join(", ")}` : ""}

## Tarefa
Gere até 3 sugestões acionáveis para hoje. Foque no que gera resultado imediato.

Retorne JSON: { "suggestions": [ { "type": "COMMERCIAL_INSIGHT|CAMPAIGN_TEXT|CLIENT_MESSAGE|SOCIAL_POST|OFFER_OPPORTUNITY", "title": "título (máx 60 chars)", "content": "texto pronto para usar", "reason": "motivo em 1 frase" } ] }`;
}
