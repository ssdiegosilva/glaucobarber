// ============================================================
// Seed: Platform Segments
// Run via POST /api/admin/segments/seed (admin-only)
// Idempotent: uses upsert on key
// ============================================================

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Prompts copied from src/lib/vertical/barbershop/config.ts — barbershop baseline
const BARBERSHOP_PROMPTS = {
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
  featureCosts: JSON.stringify({
    campaign_image: 10,
    visual_style_generate: 10,
    brand_style_logo: 10,
    vitrine_caption: 1,
  }),
  imageFeatures: JSON.stringify([
    "campaign_image",
    "visual_style_generate",
    "brand_style_logo",
  ]),
};

const ALL_MODULES = JSON.stringify([
  "dashboard",
  "agenda",
  "copilot",
  "financeiro",
  "meta",
  "clients",
  "services",
  "campaigns",
  "vitrine",
  "criar-visual",
  "whatsapp",
  "post-sale",
  "settings",
  "billing",
  "support",
]);

const SEGMENTS = [
  {
    key: "barbershop",
    displayName: "Barbearia",
    tenantLabel: "barbearia",
    description: "Gestão completa para barbearias — agenda, cortes, barba e muito mais.",
    icon: "Scissors",
    colorPrimary:    "43 52% 55%",   // gold
    colorBackground: "240 11% 7%",   // dark neutro
    colorCard:       "240 10% 11%",
    sortOrder: 0,
    availableModules: ALL_MODULES,
    serviceCategories: JSON.stringify([
      { key: "haircut", label: "Corte" },
      { key: "beard", label: "Barba" },
      { key: "combo", label: "Combo" },
      { key: "treatment", label: "Tratamento" },
      { key: "other", label: "Outro" },
    ]),
    roles: JSON.stringify([
      { key: "BARBER", label: "Barbeiro" },
      { key: "STAFF", label: "Equipe" },
    ]),
    prompts: BARBERSHOP_PROMPTS,
  },
  {
    key: "hair_salon",
    displayName: "Salão de Beleza",
    tenantLabel: "salão",
    description: "Para cabeleireiros e salões de beleza — cortes, coloração e tratamentos.",
    icon: "Sparkles",
    colorPrimary:    "320 58% 68%",  // rosa-magenta vibrante
    colorBackground: "320 10% 7%",   // dark com leve toque rosa
    colorCard:       "320 8% 11%",
    sortOrder: 1,
    availableModules: ALL_MODULES,
    serviceCategories: JSON.stringify([
      { key: "cut", label: "Corte" },
      { key: "color", label: "Coloração" },
      { key: "treatment", label: "Tratamento" },
      { key: "nails", label: "Unhas" },
      { key: "makeup", label: "Maquiagem" },
      { key: "other", label: "Outro" },
    ]),
    roles: JSON.stringify([
      { key: "STYLIST", label: "Cabeleireiro(a)" },
      { key: "STAFF", label: "Equipe" },
    ]),
    prompts: {
      ...BARBERSHOP_PROMPTS,
      copilotSystemPrompt:
        "Você é o assistente inteligente do salão de beleza. Você tem duas funções: (1) CEO Copilot do salão — analisa dados do negócio e sugere ações práticas com visão executiva; (2) assistente geral — responde qualquer pergunta fora do contexto do salão como um assistente de IA. Sempre responda em PT-BR, de forma direta e objetiva. Quando a pergunta for sobre o negócio, use o contexto fornecido e sugira ações. Nunca execute ações; apenas sugira. Responda sempre em JSON.",
      suggestionsSystemPrompt:
        "Você é o copiloto de inteligência de um salão de beleza premium. Responda sempre em JSON válido.",
      campaignTextSystemPrompt:
        "Você é especialista em marketing para salões de beleza premium. Responda em JSON.",
      brandStyleSystemPrompt:
        "Você é um diretor de arte especializado em marcas de beleza feminina premium. Expanda a descrição visual do salão em uma descrição rica e técnica de identidade visual, ideal para prompts de geração de imagem com IA. Máximo 300 caracteres. Mencione paleta de cores, elementos visuais, mood, iluminação. Retorne apenas a descrição.",
      serviceAnalysisSystemPrompt:
        "Você é um cabeleireiro especialista com 20 anos de experiência. Analisa fotos de clientes e sugere o melhor corte e coloração. Responda sempre em JSON válido.",
      vitrineCaptionSystemPrompt:
        "Você é especialista em marketing para salões de beleza. Analise a foto do trabalho e gere uma legenda profissional para Instagram em português brasileiro. Tom: inspirador, elegante, feminino. Inclua 8 a 12 hashtags relevantes ao final. Máximo 200 palavras. Retorne apenas a legenda.",
      haircutVisualPrompt:
        "Analyze the person in this image as a professional hair stylist.\n\nIdentify face shape, hair type, density, and current hair condition.\n\nSuggest the most suitable haircut and style to enhance the person's appearance, considering modern salon trends.\n\nApply the suggested style directly to the image, showing a realistic transformation.\n\nKeep the person's identity and facial features exactly the same.\n\nHair must look natural with realistic texture and volume.\n\nUse professional salon styling with clean cuts and beautiful color if applicable.\n\nUltra-realistic, professional salon result.",
    },
  },
  {
    key: "nail_studio",
    displayName: "Estúdio de Unhas",
    tenantLabel: "estúdio",
    description: "Para manicures e nail designers — agendamentos, nail art e muito mais.",
    icon: "Star",
    colorPrimary:    "345 70% 76%",  // rosa bebê
    colorBackground: "345 12% 7%",   // dark com toque rosa quente
    colorCard:       "345 10% 11%",
    sortOrder: 2,
    availableModules: JSON.stringify([
      "dashboard",
      "agenda",
      "copilot",
      "financeiro",
      "meta",
      "clients",
      "services",
      "campaigns",
      "whatsapp",
      "post-sale",
      "settings",
      "billing",
      "support",
    ]),
    serviceCategories: JSON.stringify([
      { key: "manicure", label: "Manicure" },
      { key: "pedicure", label: "Pedicure" },
      { key: "nail_art", label: "Nail Art" },
      { key: "gel", label: "Gel/Acrílico" },
      { key: "treatment", label: "Tratamento" },
      { key: "other", label: "Outro" },
    ]),
    roles: JSON.stringify([
      { key: "NAIL_ARTIST", label: "Nail Designer" },
      { key: "STAFF", label: "Equipe" },
    ]),
    prompts: {
      ...BARBERSHOP_PROMPTS,
      copilotSystemPrompt:
        "Você é o assistente inteligente do estúdio de unhas. Você tem duas funções: (1) CEO Copilot do estúdio — analisa dados do negócio e sugere ações práticas; (2) assistente geral. Sempre responda em PT-BR, de forma direta. Responda sempre em JSON.",
      suggestionsSystemPrompt:
        "Você é o copiloto de inteligência de um estúdio de nail art. Responda sempre em JSON válido.",
      campaignTextSystemPrompt:
        "Você é especialista em marketing para estúdios de nail art. Responda em JSON.",
      brandStyleSystemPrompt:
        "Você é um diretor de arte especializado em marcas de nail art. Expanda a descrição visual do estúdio em uma descrição rica para prompts de IA. Máximo 300 caracteres. Retorne apenas a descrição.",
      serviceAnalysisSystemPrompt:
        "Você é uma nail designer especialista. Analisa fotos de unhas e sugere designs e serviços. Responda sempre em JSON válido.",
      vitrineCaptionSystemPrompt:
        "Você é especialista em marketing para nail studios. Analise a foto do trabalho e gere uma legenda para Instagram em português. Tom: criativo, artístico. Inclua 8 a 12 hashtags. Máximo 200 palavras. Retorne apenas a legenda.",
    },
  },
  {
    key: "shooting_range",
    displayName: "Stand de Tiro",
    tenantLabel: "stand",
    description: "Para estandes de tiro e clubes de tiro esportivo — agendamentos e treinamentos.",
    icon: "Target",
    colorPrimary:    "20 70% 50%",   // laranja-ferrugem
    colorBackground: "20 10% 7%",    // dark com toque terra quente
    colorCard:       "20 7% 11%",
    sortOrder: 3,
    availableModules: JSON.stringify([
      "dashboard",
      "agenda",
      "copilot",
      "financeiro",
      "meta",
      "clients",
      "services",
      "whatsapp",
      "post-sale",
      "settings",
      "billing",
      "support",
    ]),
    serviceCategories: JSON.stringify([
      { key: "rental", label: "Aluguel de Arma" },
      { key: "training", label: "Treinamento" },
      { key: "course", label: "Curso" },
      { key: "membership", label: "Mensalidade" },
      { key: "other", label: "Outro" },
    ]),
    roles: JSON.stringify([
      { key: "INSTRUCTOR", label: "Instrutor" },
      { key: "STAFF", label: "Equipe" },
    ]),
    prompts: {
      ...BARBERSHOP_PROMPTS,
      copilotSystemPrompt:
        "Você é o assistente inteligente do stand de tiro. Você tem duas funções: (1) CEO Copilot do stand — analisa dados do negócio e sugere ações práticas; (2) assistente geral. Sempre responda em PT-BR, de forma direta. Responda sempre em JSON.",
      suggestionsSystemPrompt:
        "Você é o copiloto de inteligência de um stand de tiro. Responda sempre em JSON válido.",
      campaignTextSystemPrompt:
        "Você é especialista em marketing para stands de tiro esportivo. Responda em JSON.",
      brandStyleSystemPrompt:
        "Você é um diretor de arte especializado em marcas de esporte e tiro. Expanda a descrição visual do stand em uma descrição para prompts de IA. Máximo 300 caracteres. Retorne apenas a descrição.",
      serviceAnalysisSystemPrompt:
        "Você é um instrutor de tiro especialista. Analisa o perfil do cliente e sugere os melhores serviços e treinamentos. Responda sempre em JSON válido.",
      vitrineCaptionSystemPrompt:
        "Você é especialista em marketing para stands de tiro. Analise a foto e gere uma legenda para Instagram em português. Tom: técnico, esportivo, seguro. Inclua 8 a 12 hashtags. Máximo 200 palavras. Retorne apenas a legenda.",
      haircutVisualPrompt:
        "Analyze the shooting sports environment in this image. Identify equipment, facilities, and training context. Provide a professional and accurate description suitable for sports marketing. Ultra-realistic, professional result.",
    },
  },
  {
    key: "generic",
    displayName: "Outro Negócio",
    tenantLabel: "negócio",
    description: "Para qualquer outro tipo de negócio de serviços com agendamento.",
    icon: "Store",
    colorPrimary:    "220 58% 62%",  // azul aço
    colorBackground: "220 10% 7%",   // dark azul noite
    colorCard:       "220 8% 11%",
    sortOrder: 4,
    availableModules: ALL_MODULES,
    serviceCategories: JSON.stringify([
      { key: "service_1", label: "Serviço 1" },
      { key: "service_2", label: "Serviço 2" },
      { key: "service_3", label: "Serviço 3" },
      { key: "other", label: "Outro" },
    ]),
    roles: JSON.stringify([
      { key: "PROFESSIONAL", label: "Profissional" },
      { key: "STAFF", label: "Equipe" },
    ]),
    prompts: {
      ...BARBERSHOP_PROMPTS,
      copilotSystemPrompt:
        "Você é o assistente inteligente do negócio. Você tem duas funções: (1) CEO Copilot — analisa dados do negócio e sugere ações práticas com visão executiva; (2) assistente geral. Sempre responda em PT-BR, de forma direta. Responda sempre em JSON.",
      suggestionsSystemPrompt:
        "Você é o copiloto de inteligência de um negócio de serviços. Responda sempre em JSON válido.",
      campaignTextSystemPrompt:
        "Você é especialista em marketing para negócios de serviços. Responda em JSON.",
      brandStyleSystemPrompt:
        "Você é um diretor de arte especializado em marcas de serviços. Expanda a descrição visual do negócio em uma descrição para prompts de IA. Máximo 300 caracteres. Retorne apenas a descrição.",
      serviceAnalysisSystemPrompt:
        "Você é um consultor de serviços especialista. Analisa o perfil do cliente e sugere os melhores serviços disponíveis. Responda sempre em JSON válido.",
      vitrineCaptionSystemPrompt:
        "Você é especialista em marketing para negócios de serviços. Analise a foto e gere uma legenda para Instagram em português. Tom: profissional, confiante. Inclua 8 a 12 hashtags. Máximo 200 palavras. Retorne apenas a legenda.",
    },
  },
];

export async function seedSegments(): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (const seg of SEGMENTS) {
    const { prompts, ...segData } = seg;

    const existing = await prisma.segment.findUnique({ where: { key: seg.key } });

    if (existing) {
      await prisma.segment.update({
        where: { key: seg.key },
        data: {
          displayName:     segData.displayName,
          tenantLabel:     segData.tenantLabel,
          description:     segData.description,
          icon:            segData.icon,
          colorPrimary:    segData.colorPrimary,
          colorBackground: segData.colorBackground,
          colorCard:       segData.colorCard,
          sortOrder:       segData.sortOrder,
          availableModules:  segData.availableModules,
          serviceCategories: segData.serviceCategories,
          roles:             segData.roles,
          aiConfig: {
            upsert: {
              create: prompts,
              update: prompts,
            },
          },
        },
      });
      updated++;
    } else {
      await prisma.segment.create({
        data: {
          ...segData,
          aiConfig: {
            create: prompts,
          },
        },
      });
      created++;
    }
  }

  return { created, updated };
}

// Allow running directly: npx tsx prisma/seed-segments.ts
if (require.main === module) {
  seedSegments()
    .then((result) => {
      console.log(`Segments seeded: ${result.created} created, ${result.updated} updated`);
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
