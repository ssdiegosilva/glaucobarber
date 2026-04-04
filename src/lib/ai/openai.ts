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
  HaircutSuggestion,
} from "./types";

const MODEL = process.env.AI_MODEL ?? "gpt-4o-mini";
const VISION_MODEL = process.env.AI_VISION_MODEL ?? MODEL;

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

  async generateCampaignThemes(barbershopName: string): Promise<{ themes: { title: string; description: string }[] }> {
    const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

    const response = await (this.client as any).responses.create({
      model: MODEL,
      tools: [{ type: "web_search_preview" }],
      input: `Hoje é ${today}. Você é um estrategista de marketing para a barbearia "${barbershopName}".

Pesquise na internet as últimas notícias, tendências e eventos relevantes da semana no Brasil e no mundo. Com base nisso, sugira exatamente 3 temas criativos e oportunos para campanhas de marketing de barbearia no Instagram.

Cada tema deve conectar uma notícia/tendência atual com o universo da barbearia de forma inteligente e engajante.

Retorne APENAS JSON válido, sem markdown:
{
  "themes": [
    { "title": "Título curto do tema (máx 50 chars)", "description": "Conexão com a notícia/tendência em 1 frase (máx 100 chars)" }
  ]
}`,
    });

    const text = typeof response.output_text === "string"
      ? response.output_text
      : response.output?.find((o: any) => o.type === "message")?.content?.find((c: any) => c.type === "output_text")?.text ?? "{}";

    try {
      // Strip markdown code fences if present
      const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const parsed = JSON.parse(cleaned);
      return { themes: Array.isArray(parsed.themes) ? parsed.themes.slice(0, 3) : [] };
    } catch {
      return { themes: [] };
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
          content: `Crie um texto de campanha e briefing de arte visual para barbearia premium.\nTema: ${objective}\nContexto: ${context}\n\nRetorne JSON:\n{\n  "text": "copy da campanha para Instagram (máx 280 chars)",\n  "artBriefing": "direção de arte específica: descreva composição, símbolos concretos (ex: navalha dourada, bigode, coroa), mood lighting, estilo tipográfico, cores predominantes (máx 200 chars). Evite generalidades."\n}\n\nO artBriefing deve conter elementos visuais concretos que um gerador de imagem possa usar diretamente.`,
        },
      ],
    });

    const raw = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    return { text: raw.text ?? "", artBriefing: raw.artBriefing ?? "" };
  }

  async generateCampaignImage(input: {
    prompt: string; styleHint?: string; referenceImageUrl?: string;
    model?: string; size?: string; quality?: string;
  }): Promise<{ url: string } | { b64: string }> {
    const prompt  = `${input.prompt}${input.styleHint ? `\nEstilo: ${input.styleHint}` : ""}`;
    const model   = input.model   ?? "gpt-image-1";
    const quality = input.quality ?? "standard";

    // Normalize size per model — each model has different valid size options
    const GPT_IMAGE_1_SIZES = ["1024x1024", "1024x1536", "1536x1024", "auto"];
    const DALL_E_3_SIZES    = ["1024x1024", "1792x1024", "1024x1792"];
    const DALL_E_2_SIZES    = ["256x256", "512x512", "1024x1024"];
    const rawSize = input.size ?? "1024x1024";
    let size: string;
    if (model === "gpt-image-1") {
      size = GPT_IMAGE_1_SIZES.includes(rawSize) ? rawSize : "1024x1024";
    } else if (model === "dall-e-3") {
      size = DALL_E_3_SIZES.includes(rawSize) ? rawSize : "1024x1024";
    } else if (model === "dall-e-2") {
      size = DALL_E_2_SIZES.includes(rawSize) ? rawSize : "1024x1024";
    } else {
      size = "1024x1024";
    }

    // ── With reference image: always use gpt-image-1 via images.edit ─────────
    // (images.edit only supports gpt-image-1 — model param is ignored here)
    if (input.referenceImageUrl) {
      try {
        const { toFile } = await import("openai");
        const refRes = await fetch(input.referenceImageUrl);
        if (!refRes.ok) throw new Error("Não foi possível baixar a imagem de referência");
        const refBuffer   = Buffer.from(await refRes.arrayBuffer());
        const contentType = refRes.headers.get("content-type") || "image/png";
        const ext         = contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" : "png";

        const img = await this.client.images.edit({
          model:  "gpt-image-1",
          image:  await toFile(refBuffer, `reference.${ext}`, { type: contentType }),
          prompt,
          size:   size as any,
          n:      1,
        } as Parameters<typeof this.client.images.edit>[0]);

        const b64 = img.data?.[0]?.b64_json;
        if (!b64) throw new Error("gpt-image-1 não retornou imagem");
        return { b64 };
      } catch (editErr) {
        console.warn("[AI] gpt-image-1 edit falhou, usando fallback:", editErr);
        return this._generateWithDallE3(prompt, size);
      }
    }

    // ── Without reference: use configured model, fallback to dall-e-3 ───────
    try {
      return await this._generateWithModel(prompt, model, size, quality);
    } catch {
      return this._generateWithDallE3(prompt, size);
    }
  }

  private async _generateWithModel(
    prompt: string, model: string, size: string, quality: string,
  ): Promise<{ url: string } | { b64: string }> {
    if (model === "gpt-image-1") {
      const img = await this.client.images.generate({
        model: "gpt-image-1", prompt, size: size as any, n: 1,
      });
      const b64 = img.data?.[0]?.b64_json;
      if (!b64) throw new Error("gpt-image-1 não retornou imagem");
      return { b64 };
    }
    // dall-e-2 has a 1000-char prompt limit
    const finalPrompt = model === "dall-e-2" ? prompt.slice(0, 1000) : prompt;
    const params: any = { model, prompt: finalPrompt, size, n: 1 };
    if (model === "dall-e-3") params.quality = quality;
    const img = await this.client.images.generate(params);
    const url = img.data?.[0]?.url;
    if (!url) throw new Error(`${model} não retornou imagem`);
    return { url };
  }

  private async _generateWithDallE3(prompt: string, size = "1024x1024"): Promise<{ url: string }> {
    const DALL_E_3_SIZES = ["1024x1024", "1792x1024", "1024x1792"];
    const safeSize = DALL_E_3_SIZES.includes(size) ? size : "1024x1024";
    const img = await this.client.images.generate({
      model: "dall-e-3", prompt, size: safeSize as any, n: 1,
    });
    const url = img.data?.[0]?.url;
    if (!url) throw new Error("dall-e-3 não retornou imagem");
    return { url };
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
            "Você é o assistente inteligente do GlaucoBarber. Você tem duas funções: (1) CEO Copilot da barbearia — analisa dados do negócio e sugere ações práticas com visão executiva; (2) assistente geral — responde qualquer pergunta fora do contexto da barbearia como um assistente de IA. Sempre responda em PT-BR, de forma direta e objetiva. Quando a pergunta for sobre o negócio, use o contexto fornecido e sugira ações. Quando for uma pergunta geral sem relação com a barbearia, responda normalmente sem forçar ações de barbearia. Nunca execute ações; apenas sugira. Responda sempre em JSON.",
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

  async analyzeAndSuggestHaircut(imageBase64: string): Promise<HaircutSuggestion> {
    const completion = await this.client.chat.completions.create({
      model: VISION_MODEL,
      max_tokens: 512,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Você é um barbeiro especialista com 20 anos de experiência. Analisa fotos de clientes e sugere o melhor corte de cabelo masculino. Responda sempre em JSON válido.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analise o rosto desta pessoa e sugira o melhor corte de cabelo masculino.

Retorne JSON com:
{
  "faceShape": "formato do rosto (oval, redondo, quadrado, triangular, losango, oblongo)",
  "suggestedStyle": "nome do estilo recomendado (ex: Fade médio com franja texturizada)",
  "explanation": "explicação em 2-3 frases em português de por que esse corte combina com o formato do rosto e características da pessoa",
  "imagePrompt": "English prompt for AI image editing: describe exactly what haircut to apply, keeping the face identical. Be specific about fade level, top length, texture. Format: 'Give this person a [detailed haircut description], keep the face and all facial features identical, photorealistic professional photo, studio lighting'"
}`,
            },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
            },
          ],
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    try {
      const parsed = JSON.parse(raw);
      return {
        faceShape:      parsed.faceShape      ?? "indefinido",
        suggestedStyle: parsed.suggestedStyle ?? "Corte clássico",
        explanation:    parsed.explanation    ?? "",
        imagePrompt:    parsed.imagePrompt    ?? "Give this person a classic short haircut, keep face identical, photorealistic",
      };
    } catch {
      return {
        faceShape:      "indefinido",
        suggestedStyle: "Corte clássico",
        explanation:    "Corte clássico adequado para o seu formato de rosto.",
        imagePrompt:    "Give this person a classic short haircut, keep face identical, photorealistic",
      };
    }
  }

  async generateHaircutVisual(imageBuffer: Buffer, imagePrompt: string): Promise<{ url: string } | { b64: string }> {
    try {
      const { toFile } = await import("openai");
      const img = await this.client.images.edit({
        model:  "gpt-image-1",
        image:  await toFile(imageBuffer, "client.jpg", { type: "image/jpeg" }),
        prompt: imagePrompt,
        size:   "1024x1024",
        n:      1,
      } as Parameters<typeof this.client.images.edit>[0]);

      const b64 = img.data?.[0]?.b64_json;
      if (!b64) throw new Error("gpt-image-1 não retornou imagem");
      return { b64 };
    } catch (err) {
      console.warn("[AI] gpt-image-1 haircut edit falhou, usando dall-e-3:", err);
      return this._generateWithDallE3(imagePrompt);
    }
  }

  async generateBrandStyleFromLogo(logoUrl: string, barbershopName?: string): Promise<string> {
    const prompt = [
      "Analise o logo da barbearia e descreva a identidade visual em até 300 caracteres.",
      "Foque em paleta de cores, materiais, mood, iluminação e tipografia que o logo sugere.",
      barbershopName ? `Nome da barbearia: ${barbershopName}.` : null,
      "Responda apenas com a descrição, em PT-BR, sem bullet points."
    ]
      .filter(Boolean)
      .join(" ");

    const completion = await this.client.chat.completions.create({
      model: VISION_MODEL,
      max_tokens: 200,
      messages: [
        { role: "system", content: "Você é um diretor de arte que extrai identidade visual a partir de logos." },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: logoUrl } },
          ],
        },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "";
    return text.trim().slice(0, 300);
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
      "type": "campaign|reactivation_promo|post_sale_followup|post_sale_review|agenda|agenda_conflict|block_agenda|define_goal|crm|pricing|motivational",
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
- block_agenda: fechar/bloquear agenda por período de ausência (viagem, férias, folga) — inclua no payload: startDate (dd/MM/yyyy), endDate (dd/MM/yyyy), reason (ex: "viagem", "férias")
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
- Se o usuário mencionar viagem, férias, ausência ou qualquer período fora, SEMPRE inclua block_agenda com startDate e endDate extraídos da mensagem
- Nunca confirme execução. requireApproval sempre true.

## Perguntas fora do contexto da barbearia
Se o usuário perguntar algo que não tem relação com o negócio (ex: curiosidades, tecnologia, receitas, idiomas, programação, história, etc.), responda normalmente como um assistente de IA útil. Nesse caso:
- Retorne "actions": [] e "requireApproval": false
- Não force sugestões de barbearia na resposta
- Seja útil, claro e objetivo`;
}
