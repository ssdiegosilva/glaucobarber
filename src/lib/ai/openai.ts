// ============================================================
// OpenAI – AI Provider Implementation
// ============================================================

import OpenAI from "openai";
import { getVerticalConfig, getVerticalConfigForBarbershop } from "@/lib/core/vertical";
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

  /** Returns the AI config for a specific barbershop (DB + cache) or falls back to static config */
  private async _getAiConfig(barbershopId?: string) {
    if (barbershopId) {
      const v = await getVerticalConfigForBarbershop(barbershopId);
      return v.ai;
    }
    return getVerticalConfig().ai;
  }

  async generateSuggestions(ctx: AISuggestionRequest, barbershopId?: string): Promise<AISuggestion[]> {
    const ai = await this._getAiConfig(barbershopId);
    const completion = await this.client.chat.completions.create({
      model: MODEL,
      max_tokens: 1024,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: ai.suggestionsSystemPrompt,
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

  async generateCampaignThemes(barbershopName: string, _barbershopId?: string, tenantLabel = "barbearia"): Promise<{ themes: { title: string; description: string }[] }> {
    const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

    const response = await (this.client as any).responses.create({
      model: MODEL,
      tools: [{ type: "web_search_preview" }],
      input: `Hoje é ${today}. Você é um estrategista de marketing para o ${tenantLabel} "${barbershopName}".

Pesquise na internet as últimas notícias, tendências e eventos relevantes da semana no Brasil e no mundo. Com base nisso, sugira exatamente 3 temas criativos e oportunos para campanhas de marketing de ${tenantLabel} no Instagram.

Cada tema deve conectar uma notícia/tendência atual com o universo do ${tenantLabel} de forma inteligente e engajante.

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
    context: string,
    barbershopId?: string,
    tenantLabel = "estabelecimento",
  ): Promise<{ text: string; artBriefing: string }> {
    const ai = await this._getAiConfig(barbershopId);
    const completion = await this.client.chat.completions.create({
      model: MODEL,
      max_tokens: 512,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: ai.campaignTextSystemPrompt,
        },
        {
          role: "user",
          content: `Crie um texto de campanha e briefing de arte visual.\n${context}\n\nRegras para o texto:\n- Use o nome EXATO do ${tenantLabel} mencionado no contexto (nunca invente nomes genéricos)\n- Inclua hashtags relevantes usando o nome do ${tenantLabel} e hashtags do tema da campanha\n- Máximo 280 caracteres\n- O texto deve ser adequado para um ${tenantLabel}, não para barbearia\n\nRetorne JSON:\n{\n  "text": "copy da campanha para Instagram com hashtags (máx 280 chars)",\n  "artBriefing": "direção de arte específica para ${tenantLabel}: descreva composição, elementos visuais concretos e relevantes para o ${tenantLabel}, mood lighting, estilo tipográfico, cores predominantes (máx 200 chars). Evite generalidades e evite elementos de barbearia."\n}\n\nO artBriefing deve conter elementos visuais do universo de ${tenantLabel} que um gerador de imagem possa usar diretamente.`,
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

    // Normalize size per model
    const GPT_IMAGE_SIZES = ["1024x1024", "1024x1536", "1536x1024", "auto"];
    const rawSize = input.size ?? "1024x1024";
    const size = GPT_IMAGE_SIZES.includes(rawSize) ? rawSize : "1024x1024";

    // ── With reference image: use images.edit (gpt-image-1 family) ──────────
    if (input.referenceImageUrl) {
      try {
        const { toFile } = await import("openai");
        const refRes = await fetch(input.referenceImageUrl);
        if (!refRes.ok) throw new Error(`Não foi possível baixar a imagem de referência (${refRes.status})`);
        const rawBuffer = Buffer.from(await refRes.arrayBuffer());

        // gpt-image-1 images.edit requires PNG with alpha channel.
        // Convert any format (JPEG, WEBP, etc.) to RGBA PNG before sending.
        const sharp = (await import("sharp")).default;
        const pngBuffer = await sharp(rawBuffer).ensureAlpha().png().toBuffer();

        const img = await this.client.images.edit({
          model:  model as any,
          image:  await toFile(pngBuffer, "reference.png", { type: "image/png" }),
          prompt,
          size:   size as any,
          n:      1,
        } as Parameters<typeof this.client.images.edit>[0]);

        const b64 = img.data?.[0]?.b64_json;
        if (!b64) throw new Error(`${model} não retornou imagem`);
        return { b64 };
      } catch (editErr) {
        console.error(`[AI] ${model} edit falhou, usando fallback:`, editErr);
        return this._generateWithFallback(prompt, size);
      }
    }

    // ── Without reference: use configured model, fallback to gpt-image-1-mini
    try {
      return await this._generateWithModel(prompt, model, size, quality);
    } catch {
      return this._generateWithFallback(prompt, size);
    }
  }

  private async _generateWithModel(
    prompt: string, model: string, size: string, quality: string,
  ): Promise<{ b64: string }> {
    const img = await this.client.images.generate({
      model: model as any, prompt, size: size as any, quality: quality as any, n: 1,
    });
    const b64 = img.data?.[0]?.b64_json;
    if (!b64) throw new Error(`${model} não retornou imagem`);
    return { b64 };
  }

  private async _generateWithFallback(prompt: string, size = "1024x1024"): Promise<{ b64: string }> {
    const GPT_IMAGE_SIZES = ["1024x1024", "1024x1536", "1536x1024", "auto"];
    const safeSize = GPT_IMAGE_SIZES.includes(size) ? size : "1024x1024";
    const img = await this.client.images.generate({
      model: "gpt-image-1-mini", prompt, size: safeSize as any, n: 1,
    });
    const b64 = img.data?.[0]?.b64_json;
    if (!b64) throw new Error("gpt-image-1-mini não retornou imagem");
    return { b64 };
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

  async generateCopilotResponse(context: CopilotContext, question: string, barbershopId?: string): Promise<CopilotResponse> {
    const ai = await this._getAiConfig(barbershopId);
    const completion = await this.client.chat.completions.create({
      model: MODEL,
      max_tokens: 800,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: ai.copilotSystemPrompt,
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

  async improveBrandStyle(rawStyle: string, barbershopId?: string): Promise<string> {
    const ai = await this._getAiConfig(barbershopId);
    const completion = await this.client.chat.completions.create({
      model: MODEL,
      max_tokens: 200,
      messages: [
        {
          role: "system",
          content: ai.brandStyleSystemPrompt,
        },
        { role: "user", content: rawStyle },
      ],
    });

    return (completion.choices[0]?.message?.content ?? rawStyle).trim().slice(0, 300);
  }

  async analyzeAndSuggestHaircut(imageBase64: string, barbershopId?: string): Promise<HaircutSuggestion> {
    const ai = await this._getAiConfig(barbershopId);
    const completion = await this.client.chat.completions.create({
      model: VISION_MODEL,
      max_tokens: 512,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: ai.serviceAnalysisSystemPrompt,
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

  async generateHaircutVisual(imageBuffer: Buffer, suggestedStyle?: string, quality?: string, model?: string, size?: string, barbershopId?: string): Promise<{ url: string } | { b64: string }> {
    const ai   = await this._getAiConfig(barbershopId);
    const base = ai.haircutVisualPrompt;
    const prompt = suggestedStyle
      ? `${base}\n\nApply specifically: ${suggestedStyle}`
      : base;
    const resolvedModel   = model   ?? "gpt-image-1";
    const resolvedSize    = size    ?? "1024x1024";
    const resolvedQuality = quality ?? "medium";

    // gpt-image-1 family supports images.edit (photo of the client as reference)
    try {
      const { toFile } = await import("openai");
      const img = await this.client.images.edit({
        model:   resolvedModel as any,
        image:   await toFile(imageBuffer, "client.jpg", { type: "image/jpeg" }),
        prompt,
        size:    resolvedSize as any,
        quality: resolvedQuality as any,
        n:       1,
      } as Parameters<typeof this.client.images.edit>[0]);

      const b64 = img.data?.[0]?.b64_json;
      if (!b64) throw new Error(`${resolvedModel} não retornou imagem`);
      return { b64 };
    } catch (err) {
      console.warn(`[AI] ${resolvedModel} haircut edit falhou, usando fallback:`, err);
      return this._generateWithFallback(prompt, resolvedSize);
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

  async generateVitrinCaption(imageBase64: string, barbershopName: string, brandStyle?: string | null, barbershopId?: string): Promise<{ caption: string }> {
    const ai = await this._getAiConfig(barbershopId);
    const systemPrompt = ai.vitrineCaptionSystemPrompt;
    const userText = [
      `Barbearia: ${barbershopName}.`,
      brandStyle ? `Estilo de marca: ${brandStyle}.` : null,
    ].filter(Boolean).join(" ");

    const completion = await this.client.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
            { type: "text", text: userText },
          ],
        },
      ],
      max_tokens: 400,
    });

    const caption = completion.choices[0]?.message?.content?.trim() ?? "";
    return { caption };
  }

  async generateTargetedOfferMessage(
    templateBody: string,
    customerName: string,
    discount: boolean,
    discountPct: number | null,
    productNames: string[]
  ): Promise<string> {
    const discountLine = discount && discountPct
      ? `A oferta inclui ${discountPct}% de desconto nos itens: ${productNames.join(", ")}.`
      : `A oferta é sobre os itens: ${productNames.join(", ")}.`;

    const prompt = [
      `Você é um assistente de marketing que personaliza mensagens de WhatsApp para clientes de um estabelecimento.`,
      `Personalize a mensagem abaixo para o cliente chamado "${customerName}".`,
      `Mantenha o tom amigável e o conteúdo fiel ao template. ${discountLine}`,
      `Substitua {nome} pelo nome do cliente. A mensagem deve ter no máximo 3 parágrafos curtos.`,
      `Retorne APENAS o texto da mensagem, sem aspas, sem formatação extra.`,
      `\nTemplate:\n${templateBody}`,
    ].join("\n");

    const completion = await this.client.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 400,
    });

    return completion.choices[0]?.message?.content?.trim() ?? templateBody.replace("{nome}", customerName);
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

  // ── Products block (conditional) ────────────────────────
  const productsBlock = ctx.hasProducts
    ? ctx.topProducts.map((p) => `  • ${p.name} — ${p.quantitySold} un vendidas, R$ ${p.revenue.toFixed(2)}`).join("\n") || "  • Sem vendas nos últimos 30 dias"
    : "";

  // ── Agenda section (only when hasServices) ────────────
  const agendaSection = ctx.hasServices ? `
### Agenda do dia
- Ocupação: ${Math.round(ctx.occupancyRate * 100)}% (${ctx.bookedSlots}/${ctx.totalSlots} horários)
- Horários livres hoje: ${ctx.freeSlots} slots${ctx.freeWindows.length ? ` — próximos: ${ctx.freeWindows.join(", ")}` : ""}
- Receita de serviços hoje prevista: R$ ${ctx.projectedRevenue.toFixed(2)} | Realizada: R$ ${ctx.completedRevenue.toFixed(2)}
- Serviços mais vendidos: ${ctx.topServices.join(", ") || "—"}

### Sobreposições de agenda hoje
${overlapsBlock}` : "";

  // ── Products section (only when hasProducts) ──────────
  const productsSection = ctx.hasProducts ? `
### Vendas de produtos
- Receita de produtos hoje: R$ ${ctx.productRevenueToday.toFixed(2)} | No mês: R$ ${ctx.productRevenueMonth.toFixed(2)}
- Produtos mais vendidos (30d):
${productsBlock}` : "";

  // ── Revenue source note ───────────────────────────────
  const revenueNote = ctx.hasProducts && ctx.hasServices ? " (receita combinada: serviços + produtos)" : "";

  // ── Service-specific opportunities (only when hasServices)
  const serviceOpportunitiesSection = ctx.hasServices ? `
### Oportunidades de serviço pendentes de aprovação
${opportunitiesBlock}` : "";

  // ── Build action types list dynamically ───────────────
  const serviceActionTypes = ctx.hasServices ? `
- campaign: criar campanha Instagram/WhatsApp para preencher agenda ou acelerar meta
- agenda: ação para preencher horários livres de hoje ou desta semana
- agenda_conflict: reagendar cliente para resolver sobreposição (payload: clientName, phone, suggestedDay, suggestedHour)
- block_agenda: fechar/bloquear agenda por período de ausência (viagem, férias, folga) — inclua no payload: startDate (dd/MM/yyyy), endDate (dd/MM/yyyy), reason (ex: "viagem", "férias")
- pricing: sugestão de preço ou pacote de serviço para aumentar ticket médio` : "";

  const productActionTypes = ctx.hasProducts ? `
- product_promo: promoção de produto específico — inclua no payload: productNames, suggestedDiscount, message
- product_pricing: sugestão de ajuste de preço de produto — payload: { productName, currentPrice, suggestedPrice }` : "";

  const allActionTypes = [
    serviceActionTypes,
    productActionTypes,
    `- reactivation_promo: oferta especial para cliente(s) inativo(s) específico(s) — inclua no payload: clientNames, phones, suggestedDiscount, message`,
    `- post_sale_followup: mensagem de reativação genérica para lista de inativos`,
    `- post_sale_review: solicitar avaliação Google (clientes recém-atendidos)`,
    `- define_goal: recomendar ao usuário que defina a meta do mês em /financeiro > Metas`,
    `- crm: segmentação, atualização de dados de clientes`,
    ctx.hasProducts && !ctx.hasServices ? `- campaign: criar campanha Instagram/WhatsApp para divulgar produtos ou acelerar meta` : "",
    `- motivational: mensagem de reconhecimento / celebração de resultado`,
  ].filter(Boolean).join("\n");

  // ── Build action type enum for JSON schema ────────────
  const actionTypeEnum = [
    ctx.hasServices ? "campaign|agenda|agenda_conflict|block_agenda|pricing" : "",
    ctx.hasProducts ? "product_promo|product_pricing" : "",
    ctx.hasProducts && !ctx.hasServices ? "campaign" : "",
    "reactivation_promo|post_sale_followup|post_sale_review|define_goal|crm|motivational",
  ].filter(Boolean).join("|");

  // ── Service-specific rules ────────────────────────────
  const serviceRules = ctx.hasServices ? `
- Se faltam horários livres + meta abaixo de 60%, sugira campaign urgente
- Se sobreposição detectada, inclua agenda_conflict
- Se o usuário mencionar viagem, férias, ausência ou qualquer período fora, SEMPRE inclua block_agenda com startDate e endDate extraídos da mensagem` : "";

  // ── Product-specific rules ────────────────────────────
  const productRules = ctx.hasProducts ? `
- Se hasProducts e topProducts disponíveis, use dados concretos de vendas nas respostas
- Se hasProducts e receita de produtos está baixa, sugira product_promo para impulsionar vendas
- Se o usuário perguntar sobre produtos/vendas, inclua dados concretos de topProducts` : "";

  return `## Contexto atual da ${ctx.barbershopName}
Data: ${ctx.dayOfWeek}, ${ctx.date} | ${ctx.daysLeftInMonth} dias restantes no mês
Tipo de negócio: ${ctx.hasServices && ctx.hasProducts ? "serviços + produtos" : ctx.hasServices ? "somente serviços" : "somente produtos"}
${agendaSection}${productsSection}

### Meta financeira do mês${revenueNote}
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
${serviceOpportunitiesSection}

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
      "type": "${actionTypeEnum}",
      "reason": "por que agir agora — 1 frase com dado concreto do contexto",
      "payload": {}
    }
  ],
  "requireApproval": true
}

Tipos de ação disponíveis:
${allActionTypes}

Regras importantes:
- Se não há meta definida, SEMPRE inclua uma ação do tipo define_goal
- Se clientes inativos > 5, SEMPRE inclua reactivation_promo com os top candidatos do payload
- Se pendingGoogleReviews > 0, inclua post_sale_review${serviceRules}${productRules}
- Nunca confirme execução. requireApproval sempre true.

## Perguntas fora do contexto do negócio
Se o usuário perguntar algo que não tem relação com o negócio (ex: curiosidades, tecnologia, receitas, idiomas, programação, história, etc.), responda normalmente como um assistente de IA útil. Nesse caso:
- Retorne "actions": [] e "requireApproval": false
- Não force sugestões do negócio na resposta
- Seja útil, claro e objetivo`;
}
