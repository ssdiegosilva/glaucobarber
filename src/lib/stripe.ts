import Stripe from "stripe";

// ── Platform Stripe client ─────────────────────────────────
// Lazy init: only instantiated on first use, not at build time

let _stripe: Stripe | null = null;

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    if (!_stripe) {
      const key = process.env.STRIPE_SECRET_KEY;
      if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
      _stripe = new Stripe(key, { apiVersion: "2025-02-24.acacia", typescript: true });
    }
    return (_stripe as never)[prop];
  },
});

// ── Plan definitions ───────────────────────────────────────
export const PLANS = {
  FREE: {
    name:        "Free",
    description: "Trial gratuito para conhecer a plataforma",
    priceId:     "",              // no Stripe price
    monthlyBRL:  0,
    features: [
      "30 chamadas de IA (vitalício)",
      "Todos os recursos desbloqueados",
      "Acesso ao Copilot, pós-venda e campanhas",
      "Gestão financeira incluída no trial",
    ],
  },
  STARTER: {
    name:        "Start",
    description: "Para barbearias que estão começando",
    priceId:     process.env.STRIPE_PRICE_STARTER_MONTHLY ?? "",
    monthlyBRL:  8900,            // R$89/mês
    features: [
      "50 chamadas de IA por mês",
      "Agenda e gestão de clientes",
      "Copilot, pós-venda e campanhas",
      "Pós-venda com reativação automática",
    ],
  },
  PRO: {
    name:        "Pro",
    description: "Para barbearias que querem crescer",
    priceId:     process.env.STRIPE_PRICE_PRO_MONTHLY ?? "",
    monthlyBRL:  14900,           // R$149/mês base
    appointmentFeeCents: 150,     // +R$1,50 por atendimento concluído
    appointmentCapCents: 40000,   // cap em R$400/mês
    features: [
      "300 chamadas de IA por mês",
      "Gestão financeira com metas",
      "R$1,50 por atendimento concluído (cap R$400/mês)",
      "Sync automático com Trinks",
      "Todos os recursos desbloqueados",
    ],
    popular: true,
  },
  ENTERPRISE: {
    name:        "Enterprise",
    description: "Para redes e barbearias premium",
    priceId:     process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY ?? "",
    monthlyBRL:  0,               // custom pricing
    features: [
      "IA ilimitada",
      "Multi-unidade",
      "API access",
      "Suporte prioritário",
      "Onboarding dedicado",
    ],
  },
} as const;

export type PlanKey = keyof typeof PLANS;

// ── Helpers ────────────────────────────────────────────────

export async function createCheckoutSession({
  barbershopId,
  stripeCustomerId,
  priceId,
  successUrl,
  cancelUrl,
}: {
  barbershopId:     string;
  stripeCustomerId: string | null;
  priceId:          string;
  successUrl:       string;
  cancelUrl:        string;
}) {
  const params: Stripe.Checkout.SessionCreateParams = {
    mode:        "subscription",
    line_items:  [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url:  cancelUrl,
    metadata:    { barbershopId },
    subscription_data: {
      metadata: { barbershopId },
      trial_period_days: 14,
    },
  };

  if (stripeCustomerId) {
    params.customer = stripeCustomerId;
  } else {
    params.customer_creation = "always";
  }

  return stripe.checkout.sessions.create(params);
}

export async function createPortalSession({
  stripeCustomerId,
  returnUrl,
}: {
  stripeCustomerId: string;
  returnUrl:        string;
}) {
  return stripe.billingPortal.sessions.create({
    customer:   stripeCustomerId,
    return_url: returnUrl,
  });
}

export function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style:    "currency",
    currency: "BRL",
  }).format(cents / 100);
}
