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
  "produtos",
  "targeted-offers",
  "campaigns",
  "vitrine",
  "criar-visual",
  "whatsapp",
  "post-sale",
  "settings",
  "billing",
  "support",
]);

// Módulos para estabelecimentos de fluxo (sem agenda, com visitas)
const FLOW_MODULES = JSON.stringify([
  "dashboard",
  "dashboard-vendas",
  "visitas",
  "produtos",
  "targeted-offers",
  "copilot",
  "financeiro",
  "meta",
  "clients",
  "campaigns",
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
  // ── Segmentos de fluxo (walk-in, sem agendamento) ──────────

  {
    key: "bakery",
    displayName: "Padaria",
    tenantLabel: "padaria",
    description: "Para padarias e confeitarias — gestão de clientes, fidelização e campanhas.",
    icon: "Wheat",
    colorPrimary:    "30 80% 55%",   // âmbar quente
    colorBackground: "30 10% 7%",   // dark com toque dourado
    colorCard:       "30 8% 11%",
    sortOrder: 5,
    availableModules: FLOW_MODULES,
    serviceCategories: JSON.stringify([
      { key: "paes", label: "Pães" },
      { key: "doces", label: "Doces / Bolos" },
      { key: "salgados", label: "Salgados" },
      { key: "bebidas", label: "Bebidas" },
      { key: "other", label: "Outro" },
    ]),
    roles: JSON.stringify([
      { key: "BAKER", label: "Padeiro(a)" },
      { key: "STAFF", label: "Atendente" },
    ]),
    prompts: {
      ...BARBERSHOP_PROMPTS,
      copilotSystemPrompt:
        "Você é o assistente inteligente da padaria. Você tem duas funções: (1) CEO Copilot da padaria — analisa dados do negócio (visitas, receita, clientes) e sugere ações práticas com visão executiva; (2) assistente geral. Sempre responda em PT-BR, de forma direta. Responda sempre em JSON.",
      suggestionsSystemPrompt:
        "Você é o copiloto de inteligência de uma padaria. Analise os dados de visitas e clientes e sugira ações práticas de fidelização, campanhas e crescimento. Responda sempre em JSON válido.",
      campaignTextSystemPrompt:
        "Você é especialista em marketing para padarias e confeitarias. Crie textos para Instagram que despertem desejo pelo produto. Responda em JSON.",
      brandStyleSystemPrompt:
        "Você é um diretor de arte especializado em marcas de padaria artesanal. Expanda a descrição visual da padaria para prompts de IA. Máximo 300 caracteres. Retorne apenas a descrição.",
      serviceAnalysisSystemPrompt:
        "Você é um consultor de negócios para padarias. Analisa o mix de produtos e sugere oportunidades de venda. Responda sempre em JSON válido.",
      vitrineCaptionSystemPrompt:
        "Você é especialista em marketing para padarias. Analise a foto do produto e gere uma legenda apetitosa para Instagram em português. Tom: acolhedor, artesanal, delicioso. Inclua 8 a 12 hashtags. Máximo 200 palavras. Retorne apenas a legenda.",
      haircutVisualPrompt: BARBERSHOP_PROMPTS.haircutVisualPrompt,
    },
  },
  {
    key: "snack_bar",
    displayName: "Lanchonete",
    tenantLabel: "lanchonete",
    description: "Para lanchonetes e fast-food — gestão de clientes, fidelização e campanhas.",
    icon: "Sandwich",
    colorPrimary:    "16 85% 55%",   // laranja vibrante
    colorBackground: "16 10% 7%",
    colorCard:       "16 8% 11%",
    sortOrder: 6,
    availableModules: FLOW_MODULES,
    serviceCategories: JSON.stringify([
      { key: "lanches", label: "Lanches" },
      { key: "porcoes", label: "Porções" },
      { key: "bebidas", label: "Bebidas" },
      { key: "combos", label: "Combos" },
      { key: "other", label: "Outro" },
    ]),
    roles: JSON.stringify([
      { key: "COOK", label: "Cozinheiro(a)" },
      { key: "STAFF", label: "Atendente" },
    ]),
    prompts: {
      ...BARBERSHOP_PROMPTS,
      copilotSystemPrompt:
        "Você é o assistente inteligente da lanchonete. Você tem duas funções: (1) CEO Copilot da lanchonete — analisa dados do negócio (visitas, receita, clientes) e sugere ações práticas; (2) assistente geral. Sempre responda em PT-BR. Responda sempre em JSON.",
      suggestionsSystemPrompt:
        "Você é o copiloto de inteligência de uma lanchonete. Sugira ações de fidelização, promoções e crescimento. Responda sempre em JSON válido.",
      campaignTextSystemPrompt:
        "Você é especialista em marketing para lanchonetes. Crie textos irresistíveis para Instagram. Responda em JSON.",
      brandStyleSystemPrompt:
        "Você é um diretor de arte para marcas de fast-food e lanchonetes. Expanda a identidade visual para prompts de IA. Máximo 300 caracteres. Retorne apenas a descrição.",
      serviceAnalysisSystemPrompt:
        "Você é um consultor para lanchonetes. Sugira oportunidades de cardápio e promoções. Responda sempre em JSON válido.",
      vitrineCaptionSystemPrompt:
        "Você é especialista em marketing para lanchonetes. Gere uma legenda irresistível para Instagram. Tom: animado, saboroso, convidativo. Inclua 8 a 12 hashtags. Máximo 200 palavras. Retorne apenas a legenda.",
      haircutVisualPrompt: BARBERSHOP_PROMPTS.haircutVisualPrompt,
    },
  },
  {
    key: "patisserie",
    displayName: "Confeitaria / Boleria",
    tenantLabel: "confeitaria",
    description: "Para confeitarias, bolerias e cake designers — clientes, pedidos e campanhas.",
    icon: "CakeSlice",
    colorPrimary:    "340 65% 68%",  // rosa confeitaria
    colorBackground: "340 10% 7%",
    colorCard:       "340 8% 11%",
    sortOrder: 7,
    availableModules: FLOW_MODULES,
    serviceCategories: JSON.stringify([
      { key: "bolos", label: "Bolos" },
      { key: "docinhos", label: "Docinhos" },
      { key: "tortas", label: "Tortas" },
      { key: "encomendas", label: "Encomendas" },
      { key: "other", label: "Outro" },
    ]),
    roles: JSON.stringify([
      { key: "CONFECTIONER", label: "Confeiteiro(a)" },
      { key: "STAFF", label: "Atendente" },
    ]),
    prompts: {
      ...BARBERSHOP_PROMPTS,
      copilotSystemPrompt:
        "Você é o assistente inteligente da confeitaria. Você tem duas funções: (1) CEO Copilot da confeitaria — analisa dados do negócio e sugere ações práticas; (2) assistente geral. Sempre responda em PT-BR. Responda sempre em JSON.",
      suggestionsSystemPrompt:
        "Você é o copiloto de inteligência de uma confeitaria artesanal. Sugira ações de fidelização, datas comemorativas e crescimento. Responda sempre em JSON válido.",
      campaignTextSystemPrompt:
        "Você é especialista em marketing para confeitarias. Crie textos encantadores e apetitosos para Instagram. Responda em JSON.",
      brandStyleSystemPrompt:
        "Você é um diretor de arte para marcas de confeitaria artesanal. Expanda a identidade visual para prompts de IA. Máximo 300 caracteres. Retorne apenas a descrição.",
      serviceAnalysisSystemPrompt:
        "Você é um consultor para confeitarias. Sugira oportunidades de produto para datas comemorativas e promoções. Responda sempre em JSON válido.",
      vitrineCaptionSystemPrompt:
        "Você é especialista em marketing para confeitarias. Gere uma legenda deliciosa para Instagram. Tom: artesanal, romântico, tentador. Inclua 8 a 12 hashtags. Máximo 200 palavras. Retorne apenas a legenda.",
      haircutVisualPrompt: BARBERSHOP_PROMPTS.haircutVisualPrompt,
    },
  },
  {
    key: "coffee_shop",
    displayName: "Cafeteria",
    tenantLabel: "cafeteria",
    description: "Para cafeterias e coffee shops — clientes, fidelidade e campanhas.",
    icon: "Coffee",
    colorPrimary:    "25 55% 45%",   // marrom café
    colorBackground: "25 10% 7%",
    colorCard:       "25 8% 11%",
    sortOrder: 8,
    availableModules: FLOW_MODULES,
    serviceCategories: JSON.stringify([
      { key: "cafes", label: "Cafés" },
      { key: "cha", label: "Chás" },
      { key: "alimentos", label: "Alimentos" },
      { key: "especiais", label: "Especiais" },
      { key: "other", label: "Outro" },
    ]),
    roles: JSON.stringify([
      { key: "BARISTA", label: "Barista" },
      { key: "STAFF", label: "Atendente" },
    ]),
    prompts: {
      ...BARBERSHOP_PROMPTS,
      copilotSystemPrompt:
        "Você é o assistente inteligente da cafeteria. Analisa dados do negócio (visitas, receita, clientes) e sugere ações práticas de fidelização e crescimento. Sempre responda em PT-BR. Responda sempre em JSON.",
      suggestionsSystemPrompt:
        "Você é o copiloto de inteligência de uma cafeteria. Sugira ações de fidelização, horários de pico e crescimento. Responda sempre em JSON válido.",
      campaignTextSystemPrompt:
        "Você é especialista em marketing para cafeterias e coffee shops. Crie textos aconchegantes e cativantes para Instagram. Responda em JSON.",
      brandStyleSystemPrompt:
        "Você é um diretor de arte para marcas de cafeteria artesanal. Expanda a identidade visual para prompts de IA. Máximo 300 caracteres. Retorne apenas a descrição.",
      serviceAnalysisSystemPrompt:
        "Você é um consultor para cafeterias. Sugira oportunidades de cardápio e promoções sazonais. Responda sempre em JSON válido.",
      vitrineCaptionSystemPrompt:
        "Você é especialista em marketing para cafeterias. Gere uma legenda aconchegante para Instagram. Tom: acolhedor, artesanal, especial. Inclua 8 a 12 hashtags. Máximo 200 palavras. Retorne apenas a legenda.",
      haircutVisualPrompt: BARBERSHOP_PROMPTS.haircutVisualPrompt,
    },
  },
  {
    key: "pet_shop",
    displayName: "Pet Shop",
    tenantLabel: "pet shop",
    description: "Para pet shops — produtos, banho & tosa e campanhas de fidelização.",
    icon: "Dog",
    colorPrimary:    "160 55% 50%",  // verde-azulado pet
    colorBackground: "160 10% 7%",
    colorCard:       "160 8% 11%",
    sortOrder: 9,
    availableModules: JSON.stringify([
      "dashboard",
      "dashboard-vendas",
      "visitas",
      "agenda",        // tosa/banho ainda pode usar agenda
      "copilot",
      "financeiro",
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
      { key: "banho_tosa", label: "Banho & Tosa" },
      { key: "veterinario", label: "Veterinário" },
      { key: "racao", label: "Ração / Produtos" },
      { key: "acessorios", label: "Acessórios" },
      { key: "other", label: "Outro" },
    ]),
    roles: JSON.stringify([
      { key: "GROOMER", label: "Tosador(a)" },
      { key: "STAFF", label: "Atendente" },
    ]),
    prompts: {
      ...BARBERSHOP_PROMPTS,
      copilotSystemPrompt:
        "Você é o assistente inteligente do pet shop. Analisa dados do negócio (visitas, serviços, receita) e sugere ações práticas de fidelização e crescimento. Sempre responda em PT-BR. Responda sempre em JSON.",
      suggestionsSystemPrompt:
        "Você é o copiloto de inteligência de um pet shop. Sugira ações de reativação de clientes, promoções e crescimento. Responda sempre em JSON válido.",
      campaignTextSystemPrompt:
        "Você é especialista em marketing para pet shops. Crie textos carinhosos e persuasivos para Instagram. Responda em JSON.",
      brandStyleSystemPrompt:
        "Você é um diretor de arte para marcas de pet shop. Expanda a identidade visual para prompts de IA. Máximo 300 caracteres. Retorne apenas a descrição.",
      serviceAnalysisSystemPrompt:
        "Você é um consultor para pet shops. Sugira oportunidades de serviço e produto baseado no perfil dos clientes. Responda sempre em JSON válido.",
      vitrineCaptionSystemPrompt:
        "Você é especialista em marketing para pet shops. Gere uma legenda carinhosa para Instagram. Tom: amoroso, cuidadoso, alegre. Inclua 8 a 12 hashtags. Máximo 200 palavras. Retorne apenas a legenda.",
      haircutVisualPrompt: BARBERSHOP_PROMPTS.haircutVisualPrompt,
    },
  },
  {
    key: "gym",
    displayName: "Academia / Crossfit",
    tenantLabel: "academia",
    description: "Para academias e estúdios fitness — check-ins, alunos e campanhas.",
    icon: "BicepsFlexed",
    colorPrimary:    "210 75% 55%",  // azul energia
    colorBackground: "210 12% 7%",
    colorCard:       "210 9% 11%",
    sortOrder: 10,
    availableModules: FLOW_MODULES,
    serviceCategories: JSON.stringify([
      { key: "mensalidade", label: "Mensalidade" },
      { key: "personal", label: "Personal Trainer" },
      { key: "aula", label: "Aula em Grupo" },
      { key: "avaliacao", label: "Avaliação Física" },
      { key: "other", label: "Outro" },
    ]),
    roles: JSON.stringify([
      { key: "TRAINER", label: "Personal Trainer" },
      { key: "STAFF", label: "Recepção" },
    ]),
    prompts: {
      ...BARBERSHOP_PROMPTS,
      copilotSystemPrompt:
        "Você é o assistente inteligente da academia. Analisa dados (check-ins, alunos ativos, receita) e sugere ações práticas de retenção e crescimento. Sempre responda em PT-BR. Responda sempre em JSON.",
      suggestionsSystemPrompt:
        "Você é o copiloto de inteligência de uma academia. Sugira ações para reduzir churn, aumentar engajamento e crescer a base. Responda sempre em JSON válido.",
      campaignTextSystemPrompt:
        "Você é especialista em marketing para academias e estúdios fitness. Crie textos motivadores para Instagram. Responda em JSON.",
      brandStyleSystemPrompt:
        "Você é um diretor de arte para marcas fitness e academias. Expanda a identidade visual para prompts de IA. Máximo 300 caracteres. Retorne apenas a descrição.",
      serviceAnalysisSystemPrompt:
        "Você é um consultor fitness. Sugira planos e serviços com base no perfil dos alunos. Responda sempre em JSON válido.",
      vitrineCaptionSystemPrompt:
        "Você é especialista em marketing fitness. Gere uma legenda motivadora para Instagram. Tom: enérgico, inspirador, desafiador. Inclua 8 a 12 hashtags. Máximo 200 palavras. Retorne apenas a legenda.",
      haircutVisualPrompt: BARBERSHOP_PROMPTS.haircutVisualPrompt,
    },
  },
  {
    key: "restaurant",
    displayName: "Restaurante",
    tenantLabel: "restaurante",
    description: "Para restaurantes e bistrôs — clientes, fidelização e campanhas.",
    icon: "Utensils",
    colorPrimary:    "355 70% 55%",  // vermelho restaurante
    colorBackground: "355 10% 7%",
    colorCard:       "355 8% 11%",
    sortOrder: 11,
    availableModules: FLOW_MODULES,
    serviceCategories: JSON.stringify([
      { key: "almoco", label: "Almoço" },
      { key: "jantar", label: "Jantar" },
      { key: "porcoes", label: "Porções" },
      { key: "bebidas", label: "Bebidas" },
      { key: "other", label: "Outro" },
    ]),
    roles: JSON.stringify([
      { key: "CHEF", label: "Chef" },
      { key: "STAFF", label: "Garçom / Atendente" },
    ]),
    prompts: {
      ...BARBERSHOP_PROMPTS,
      copilotSystemPrompt:
        "Você é o assistente inteligente do restaurante. Analisa dados de visitas, receita e clientes e sugere ações práticas de fidelização e crescimento. Sempre responda em PT-BR. Responda sempre em JSON.",
      suggestionsSystemPrompt:
        "Você é o copiloto de inteligência de um restaurante. Sugira ações de reativação de clientes, promoções especiais e crescimento. Responda sempre em JSON válido.",
      campaignTextSystemPrompt:
        "Você é especialista em marketing para restaurantes. Crie textos apetitosos e convidativos para Instagram. Responda em JSON.",
      brandStyleSystemPrompt:
        "Você é um diretor de arte para marcas de restaurante. Expanda a identidade visual para prompts de IA. Máximo 300 caracteres. Retorne apenas a descrição.",
      serviceAnalysisSystemPrompt:
        "Você é um consultor gastronômico. Sugira oportunidades de cardápio e promoções. Responda sempre em JSON válido.",
      vitrineCaptionSystemPrompt:
        "Você é especialista em marketing para restaurantes. Gere uma legenda para Instagram que faça o prato parecer irresistível. Tom: sofisticado, saboroso, acolhedor. Inclua 8 a 12 hashtags. Máximo 200 palavras. Retorne apenas a legenda.",
      haircutVisualPrompt: BARBERSHOP_PROMPTS.haircutVisualPrompt,
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
