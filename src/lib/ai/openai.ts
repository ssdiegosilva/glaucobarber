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

  async improveBrandStyle(rawStyle: string): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: MODEL,
      max_tokens: 200,
      messages: [
        {
          role: "system",
          content:
            "Você é um diretor de arte especializado em marcas premium masculinas. Expanda a descrição visual da barbearia em uma descrição rica e técnica de identidade visual, ideal para prompts de geração de imagem com IA (DALL-E). Máximo 300 caracteres. Seja específico: mencione paleta de cores, elementos visuais, mood, iluminação, tipografia. Retorne apenas a descrição, sem explicações.",
        },
        { role: "user", content: rawStyle },
      ],
    });

    return (completion.choices[0]?.message?.content ?? rawStyle).trim().slice(0, 300);
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
  // ── Published campaigns block ──────────────────────────
  const publishedBlock = ctx.publishedCampaigns.length > 0
    ? ctx.publishedCampaigns.map((c) => `  • ${c.title}${c.permalink ? ` → ${c.permalink}` : ""}`).join("\n")
    : "  • Nenhuma publicada ainda";

  // ── Overlaps block ─────────────────────────────────────
  const overlapsBlock = ctx.overlaps.length > 0
    ? ctx.overlaps.map((o) => {
        const pro = o.professionalName ? ` (${o.professionalName})` : "";
        const alt = o.alternativeHint ? ` — histórico: ${o.alternativeHint}` : "";
        return `  • ${o.clientA.name} às ${o.startA} x ${o.clientB.name} às ${o.startB}${pro}${alt}`;
      }).join("\n")
    : "  • Nenhuma sobreposição detectada";

  // ── Monthly goal block ─────────────────────────────────
  let goalBlock: string;
  if (!ctx.monthGoalSet) {
    goalBlock = `⚠️ ATENÇÃO: Nenhuma meta definida para este mês. Recomende ao usuário que acesse /financeiro > Metas para definir.`;
  } else {
    const pct     = ctx.monthRevenuePct != null ? Math.round(ctx.monthRevenuePct * 100) : null;
    const emoji   = pct == null ? "" : pct >= 90 ? "🟢" : pct >= 60 ? "🟡" : "🔴";
    const gap     = ctx.monthRevenueTarget != null ? Math.max(ctx.monthRevenueTarget - ctx.monthRevenueActual, 0) : null;
    const apptLine = ctx.monthApptTarget
      ? `\n- Atendimentos: ${ctx.monthApptActual} / ${ctx.monthApptTarget} (${Math.round(Math.min(ctx.monthApptActual / ctx.monthApptTarget, 1) * 100)}%)`
      : "";
    goalBlock = [
      `${emoji} Receita este mês: R$ ${ctx.monthRevenueActual.toFixed(2)} / R$ ${ctx.monthRevenueTarget?.toFixed(2) ?? "—"} (${pct ?? "—"}%)`,
      gap && gap > 0
        ? `- Faltam R$ ${gap.toFixed(2)} nos próximos ${ctx.daysLeftInMonth} dias (R$ ${ctx.dailyRevenueNeeded?.toFixed(2) ?? "—"}/dia necessário)`
        : `- Meta de receita atingida! ✅`,
      apptLine,
    ].filter(Boolean).join("\n");
  }

  // ── Reactivation opportunities block ──────────────────
  const reactivationBlock = ctx.topInactiveForPromo.length > 0
    ? ctx.topInactiveForPromo.map((c) =>
        `  • ${c.name} — ${c.daysSince}d sem visita${c.lastService ? `, último: ${c.lastService}` : ""}${c.phone ? ` · ${c.phone}` : ""}`
      ).join("\n")
    : "  • Nenhum cliente elegível no momento";

  // ── Active offers block ───────────────────────────────
  const offersBlock = ctx.activeOffers.length > 0
    ? ctx.activeOffers.map((o) => `  • ${o.title} — R$ ${o.salePrice.toFixed(2)} (${o.type})`).join("\n")
    : "  • Nenhuma oferta ativa no momento";

  // ── Pending service opportunities block ───────────────
  const opportunitiesBlock = ctx.pendingOpportunities.length > 0
    ? ctx.pendingOpportunities.map((o) => `  • ${o.name} (${o.category}) — preço sugerido R$ ${o.suggestedPrice.toFixed(2)}`).join("\n")
    : "  • Nenhuma oportunidade pendente";

  // ── Motivational tone hint ─────────────────────────────
  const motivationalHint = (() => {
    if (!ctx.monthGoalSet) return "Incentive o usuário a definir metas — é o primeiro passo para crescer com intenção.";
    const pct = ctx.monthRevenuePct ?? 0;
    if (pct >= 1.0)   return "Meta atingida! Use tom celebratório. Sugira superar a meta ou consolidar os resultados.";
    if (pct >= 0.8)   return "Quase lá! Use tom motivacional de reta final. Uma campanha ou oferta pode fechar o mês com chave de ouro.";
    if (pct >= 0.5)   return "Progresso no caminho certo. Foque nas alavancas com maior retorno: reativação + agenda cheia.";
    if (pct >= 0.25)  return "Ainda há tempo, mas é hora de agir. Recomende ações de reativação e campanhas imediatas.";
    return "Meta muito abaixo — seja honesto mas construtivo. Sugira ações urgentes e revisão da meta se necessário.";
  })();

  return `## Contexto atual da ${ctx.barbershopName}
Data: ${ctx.dayOfWeek}, ${ctx.date} | ${ctx.daysLeftInMonth} dias restantes no mês

### Agenda do dia
- Ocupação: ${Math.round(ctx.occupancyRate * 100)}% (${ctx.bookedSlots}/${ctx.totalSlots} horários)
- Horários livres hoje: ${ctx.freeSlots} slots${ctx.freeWindows.length ? ` — próximos: ${ctx.freeWindows.join(", ")}` : ""}
- Receita do dia prevista: R$ ${ctx.projectedRevenue.toFixed(2)} | Realizada: R$ ${ctx.completedRevenue.toFixed(2)}
- Serviços mais vendidos: ${ctx.topServices.join(", ") || "—"}

### Sobreposições de agenda hoje
${overlapsBlock}

### Meta financeira do mês
${goalBlock}

### Oportunidades de reativação (clientes inativos / em risco)
Total em risco: ${ctx.clientsAtRisk} | Total inativos: ${ctx.clientsInactive} | Reativados (60d): ${ctx.clientsReactivated}
Top candidatos para promoção:
${reactivationBlock}

### Avaliações Google
- Pendentes (últimas 48h): ${ctx.pendingGoogleReviews}

### Ofertas ativas
${offersBlock}
⚠️ Regra: ao sugerir promos/descontos, NÃO ofereça para clientes RECENTE. Priorize EM_RISCO e INATIVO. Use ofertas existentes antes de criar novas.

### Oportunidades de serviço pendentes de aprovação
${opportunitiesBlock}

### Campanhas
- Ativas/aprovadas: ${ctx.activeCampaigns.join(", ") || "nenhuma"}
- Publicadas no Instagram:
${publishedBlock}

---
Tom de resposta: ${motivationalHint}

Pergunta do usuário: ${question}

Responda em JSON:
{
  "answer": "resposta executiva em 2–4 frases, tom adequado ao progresso da meta",
  "actions": [
    {
      "title": "título da ação (curto)",
      "description": "o que fazer exatamente — seja específico",
      "type": "campaign|reactivation_promo|post_sale_followup|post_sale_review|agenda|agenda_conflict|define_goal|crm|pricing|motivational",
      "reason": "por que agir agora — 1 frase com dado concreto do contexto",
      "payload": {}
    }
  ],
  "requireApproval": true
}

Tipos de ação disponíveis:
- campaign: criar campanha Instagram/WhatsApp para preencher agenda ou acelerar meta
- reactivation_promo: oferta especial para cliente(s) inativo(s) específico(s) — inclua no payload: clientNames, phones, suggestedDiscount, message
- post_sale_followup: mensagem de reativação genérica para lista de inativos
- post_sale_review: solicitar avaliação Google (clientes recém-atendidos)
- agenda: ação para preencher horários livres de hoje ou desta semana
- agenda_conflict: reagendar cliente para resolver sobreposição (payload: clientName, phone, suggestedDay, suggestedHour)
- define_goal: recomendar ao usuário que defina a meta do mês em /financeiro > Metas
- crm: segmentação, atualização de dados de clientes
- pricing: sugestão de preço ou pacote para aumentar ticket médio
- motivational: mensagem de reconhecimento / celebração de resultado

Regras importantes:
- Se não há meta definida, SEMPRE inclua uma ação do tipo define_goal
- Se faltam horários livres + meta abaixo de 60%, sugira campaign urgente
- Se clientes inativos > 5, SEMPRE inclua reactivation_promo com os top candidatos do payload
- Se pendingGoogleReviews > 0, inclua post_sale_review
- Se sobreposição detectada, inclua agenda_conflict
- Nunca confirme execução. requireApproval sempre true.`;
}
