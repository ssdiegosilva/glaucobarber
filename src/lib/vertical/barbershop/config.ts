// ============================================================
// Vertical: Barbearia
// ============================================================
// Domain-specific configuration for the barbershop vertical.
// All hardcoded barbershop values from billing, AI, storage,
// and messaging are centralized here.
// ============================================================

import type { VerticalConfig } from "@/lib/core/vertical";

export const barbershopVertical: VerticalConfig = {
  id: "barbershop",
  displayName: "Barbearia",
  tenantLabel: "barbearia",

  // ── Billing ───────────────────────────────────────────────
  billing: {
    featureGates: {
      FREE: ["financeiro", "meta", "whatsapp_auto", "campaigns", "copilot", "criar-visual", "post-sale"],
      PRO:        [],
      ENTERPRISE: [],
    },
  },

  // ── AI ────────────────────────────────────────────────────
  ai: {
    featureCosts: {
      campaign_image:        10,
      visual_style_generate: 10,
      brand_style_logo:      10,
      vitrine_caption:       1,  // gpt-4o-mini vision
      // everything else defaults to 1
    },
    featureLabels: {
      copilot_chat:          "Chat com Copilot",
      goals_suggest:         "Sugestão de Meta",
      post_sale:             "Mensagem Pós-venda",
      ai_suggestion:         "Sugestão do Copilot",
      price_recommend:       "Recomendação de Preço",
      opportunities:         "Oportunidades de Serviço",
      campaign_image:        "Imagem de Campanha",
      campaign_text:         "Texto de Campanha",
      campaign_themes:       "Temas de Campanha",
      brand_style_improve:   "Identidade Visual (texto)",
      brand_style_logo:      "Identidade Visual (logo)",
      visual_style_analyze:  "Criar Visual (análise)",
      visual_style_generate: "Criar Visual (geração)",
      whatsapp_template:     "Template de WhatsApp",
      whatsapp_personalize:  "Mensagem WhatsApp (IA)",
      vitrine_caption:       "Legenda de Vitrine",
      targeted_offer:        "Oferta Direcionada",
    },
    imageFeatures: ["campaign_image", "visual_style_generate", "brand_style_logo"],
    copilotSystemPrompt:
      "Você é o assistente inteligente do GlaucoBarber. Você tem duas funções: (1) CEO Copilot da barbearia — analisa dados do negócio e sugere ações práticas com visão executiva; (2) assistente geral — responde qualquer pergunta fora do contexto da barbearia como um assistente de IA. Sempre responda em PT-BR, de forma direta e objetiva. Quando a pergunta for sobre o negócio, use o contexto fornecido e sugira ações. Quando for uma pergunta geral sem relação com a barbearia, responda normalmente sem forçar ações de barbearia. Nunca execute ações; apenas sugira. Responda sempre em JSON.",
    suggestionsSystemPrompt:
      "Você é o copiloto de inteligência de uma barbearia premium. Responda sempre em JSON válido.",
    campaignTextSystemPrompt:
      "Você é especialista em marketing para barbearias premium. Responda em JSON.",
    brandStyleSystemPrompt:
      "Você é um diretor de arte especializado em marcas premium masculinas. Expanda a descrição visual da barbearia em uma descrição rica e técnica de identidade visual, ideal para prompts de geração de imagem com IA (DALL-E). Máximo 300 caracteres. Seja específico: mencione paleta de cores, elementos visuais, mood, iluminação, tipografia. Retorne apenas a descrição, sem explicações.",
    serviceAnalysisSystemPrompt:
      "Você é um barbeiro especialista com 20 anos de experiência. Analisa fotos de clientes e sugere o melhor corte de cabelo masculino. Responda sempre em JSON válido.",
    vitrineCaptionSystemPrompt:
      "Você é especialista em marketing para barbearias. Analise a foto do trabalho (corte, barba ou estilo) e gere uma legenda profissional para Instagram em português brasileiro. Identifique a técnica e o estilo visíveis na imagem. Tom: confiante, aspiracional, autêntico — como um barbeiro orgulhoso do próprio trabalho. Inclua 8 a 12 hashtags relevantes ao final. Máximo 200 palavras. Retorne apenas a legenda, sem explicações.",
    haircutVisualPrompt:
      "Analyze the person in this image as a professional barber and stylist.\n\nFirst, identify face shape, hair type, density, and current haircut condition.\n\nThen suggest the most suitable haircut to enhance the person's appearance, considering modern barber trends and facial harmony.\n\nApply the suggested haircut directly to the image, showing a realistic transformation.\n\nKeep the person's identity, facial structure, and natural features exactly the same.\n\nHair must look natural, with realistic texture, volume, and flow — no artificial or painted look.\n\nUse professional barber styling:\n- clean fade (low, mid, or high — choose what fits best)\n- precise line-up if appropriate\n- natural blending and transitions\n- well-defined texture on top\n\nLighting should be studio-quality to highlight hair details.\n\nStyle inspired by premium barbershops and modern grooming brands.\n\nAlso ensure the result looks like a real haircut that could be executed in real life.\n\nAvoid exaggerated, unrealistic, or overly stylized hair.\n\nUltra-realistic, professional barber result.",
  },

  // ── Storage ───────────────────────────────────────────────
  storage: {
    bucketName: "campaign-images",
  },

  // ── Messaging ─────────────────────────────────────────────
  messaging: {
    defaultCountryCode: "55", // Brazil
  },

  // ── Roles ─────────────────────────────────────────────────
  roles: {
    available: ["OWNER", "BARBER", "STAFF"],
    professionalRole: "BARBER",
  },
};
