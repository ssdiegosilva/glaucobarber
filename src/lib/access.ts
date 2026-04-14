import { prisma } from "@/lib/prisma";

export const ALL_FEATURES = [
  { key: "dashboard",    label: "Dashboard",     description: "Visão geral da barbearia" },
  { key: "agenda",       label: "Agenda",        description: "Agendamentos" },
  { key: "visitas",      label: "Visitas",       description: "Registro de visitas para estabelecimentos de fluxo (sem agendamento)" },
  { key: "copilot",      label: "Copilot IA",    description: "Assistente com inteligência artificial" },
  { key: "financeiro",   label: "Financeiro",    description: "Relatórios e gestão financeira" },
  { key: "meta",         label: "Metas",         description: "Acompanhamento de metas diárias e mensais" },
  { key: "clients",      label: "Clientes",      description: "Gestão de clientes" },
  { key: "services",     label: "Serviços",      description: "Catálogo de serviços" },
  { key: "offers",       label: "Ofertas",       description: "Promoções e descontos" },
  { key: "campaigns",     label: "Campanhas",      description: "Marketing e comunicação" },
  { key: "vitrine",       label: "Vitrine",        description: "Posts de trabalhos em carrossel no Instagram" },
  { key: "criar-visual",  label: "Criar Visual",   description: "Análise de foto e sugestão de corte com IA" },
  { key: "whatsapp",      label: "WhatsApp",       description: "Mensagens automáticas" },
  { key: "whatsapp_auto", label: "WhatsApp Automático", description: "Bot envia mensagens agendadas automaticamente (a cada 15 min)" },
  { key: "post-sale",    label: "Pós-venda",     description: "Ações pós-atendimento" },
  { key: "settings",     label: "Configurações", description: "Ajustes da barbearia" },
  { key: "billing",      label: "Plano",         description: "Assinatura e cobrança" },
] as const;

export type FeatureKey = typeof ALL_FEATURES[number]["key"];

export const PLAN_TIERS = ["TRIAL", "FREE", "PRO"] as const;
export type PlanTierKey = typeof PLAN_TIERS[number];

/**
 * Check access to a batch of features for a given barbershop + plan.
 * Per-barbershop FeatureFlag overrides take priority over the plan matrix.
 * Returns a map of feature → enabled.
 * Default: allowed if no gate record exists.
 */
export async function getFeatureAccess(
  barbershopId: string | null,
  planTier: string,
  features: string[] = ALL_FEATURES.map((f) => f.key)
): Promise<Record<string, boolean>> {
  // PLATFORM_ADMIN always has access to everything — no DB query needed
  if (planTier === "PLATFORM_ADMIN") {
    return Object.fromEntries(features.map((f) => [f, true]));
  }

  const [gates, overrides] = await Promise.all([
    prisma.planFeatureGate.findMany({
      where: { planTier, feature: { in: features } },
    }),
    barbershopId
      ? prisma.featureFlag.findMany({
          where: { barbershopId, flag: { in: features } },
        })
      : Promise.resolve([]),
  ]);

  return Object.fromEntries(
    features.map((f) => {
      const override = overrides.find((o) => o.flag === f);
      if (override) return [f, override.enabled];
      const gate = gates.find((g) => g.feature === f);
      if (gate !== undefined) return [f, gate.enabled];
      return [f, false]; // default: deny (use seed-feature-gates.ts to populate)
    })
  );
}

/**
 * Check a single feature. Lighter version of getFeatureAccess.
 */
export async function canAccess(
  barbershopId: string | null,
  planTier: string,
  feature: string
): Promise<boolean> {
  const map = await getFeatureAccess(barbershopId, planTier, [feature]);
  return map[feature] ?? false;
}

/**
 * Get the full feature matrix for all plans (used by admin and billing page).
 */
export async function getFullFeatureMatrix(): Promise<Record<string, Record<string, boolean>>> {
  const gates = await prisma.planFeatureGate.findMany();
  const features = ALL_FEATURES.map((f) => f.key);

  return Object.fromEntries(
    features.map((feature) => {
      const row = Object.fromEntries(
        PLAN_TIERS.map((tier) => {
          const gate = gates.find((g) => g.feature === feature && g.planTier === tier);
          return [tier, gate?.enabled ?? true];
        })
      );
      return [feature, row];
    })
  );
}
