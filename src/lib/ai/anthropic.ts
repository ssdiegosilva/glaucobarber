// ============================================================
// Anthropic Claude – AI Provider Implementation
// ============================================================

import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, AISuggestionRequest, AISuggestion } from "./types";

const MODEL = process.env.AI_MODEL ?? "claude-3-5-haiku-20241022";

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async generateSuggestions(ctx: AISuggestionRequest): Promise<AISuggestion[]> {
    const prompt = buildSuggestionsPrompt(ctx);

    const msg = await this.client.messages.create({
      model:      MODEL,
      max_tokens: 1024,
      messages:   [{ role: "user", content: prompt }],
    });

    const text = msg.content.find((b) => b.type === "text")?.text ?? "[]";

    try {
      const raw = JSON.parse(extractJson(text));
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  async generateCampaignText(
    objective: string,
    context:   string
  ): Promise<{ text: string; artBriefing: string }> {
    const msg = await this.client.messages.create({
      model:      MODEL,
      max_tokens: 512,
      messages: [{
        role: "user",
        content: `Você é um especialista em marketing para barbearias premium.

Crie um texto de campanha e um briefing para arte com base nas informações abaixo.

Objetivo: ${objective}
Contexto: ${context}

Retorne JSON com os campos: text (copy da campanha, máx 280 chars), artBriefing (instruções para criação da arte, máx 200 chars).`,
      }],
    });

    const raw = JSON.parse(extractJson(msg.content.find((b) => b.type === "text")?.text ?? "{}"));
    return { text: raw.text ?? "", artBriefing: raw.artBriefing ?? "" };
  }

  async generateClientMessage(
    clientName:      string,
    daysSinceVisit:  number,
    services:        string[]
  ): Promise<string> {
    const msg = await this.client.messages.create({
      model:      MODEL,
      max_tokens: 256,
      messages: [{
        role: "user",
        content: `Escreva uma mensagem de reativação para um cliente de barbearia.
Nome: ${clientName}
Dias sem visitar: ${daysSinceVisit}
Serviços que costuma fazer: ${services.join(", ")}

Regras: informal, simpático, máx 2 frases, sem emojis excessivos, inclua CTA para agendar.
Retorne apenas o texto da mensagem.`,
      }],
    });

    return msg.content.find((b) => b.type === "text")?.text ?? "";
  }
}

// ── Prompt builders ───────────────────────────────────────

function buildSuggestionsPrompt(ctx: AISuggestionRequest): string {
  return `Você é o copiloto de inteligência da ${ctx.barbershopName}, uma barbearia premium.

## Contexto operacional de hoje (${ctx.dayOfWeek}, ${ctx.date})
- Horários totais: ${ctx.totalSlots}
- Agendados: ${ctx.bookedSlots}
- Horários livres: ${ctx.freeSlots}
- Taxa de ocupação: ${Math.round(ctx.occupancyRate * 100)}%
- Faturamento previsto hoje: R$ ${ctx.revenueToday.toFixed(2)}
${ctx.revenueGoal ? `- Meta mensal de faturamento: R$ ${ctx.revenueGoal.toFixed(2)}` : ""}
- Serviços mais populares: ${ctx.topServices.join(", ")}
- Clientes inativos (>30 dias): ${ctx.inactiveClients}
${ctx.recentCampaigns.length > 0 ? `- Campanhas recentes: ${ctx.recentCampaigns.join(", ")}` : ""}
${ctx.goals ? `- Metas: ${ctx.goals}` : ""}

## Tarefa
Gere até 3 sugestões acionáveis e específicas para hoje. Foque no que vai gerar mais resultado imediato.

Retorne um JSON array com objetos no formato:
[
  {
    "type": "COMMERCIAL_INSIGHT" | "CAMPAIGN_TEXT" | "CLIENT_MESSAGE" | "SOCIAL_POST" | "OFFER_OPPORTUNITY",
    "title": "título curto (máx 60 chars)",
    "content": "conteúdo da sugestão (pode ser o texto pronto para usar)",
    "reason": "motivo objetivo em 1 frase"
  }
]

Regras:
- Seja direto e prático
- "content" deve ser algo que o barbeiro possa usar imediatamente
- Priorize sugestões para os gaps mais críticos
- Retorne APENAS o JSON, sem markdown`;
}

function extractJson(text: string): string {
  const start = text.indexOf("[");
  const end   = text.lastIndexOf("]");
  if (start === -1 || end === -1) {
    const os = text.indexOf("{");
    const oe = text.lastIndexOf("}");
    if (os !== -1 && oe !== -1) return text.slice(os, oe + 1);
    return "[]";
  }
  return text.slice(start, end + 1);
}
