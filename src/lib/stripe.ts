import Stripe from "stripe";

// ── Platform Stripe client ─────────────────────────────────
// Lazy init: only instantiated on first use, not at build time

let _stripe: Stripe | null = null;

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    if (!_stripe) {
      const key = process.env.STRIPE_SECRET_KEY;
      if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
      _stripe = new Stripe(key, { apiVersion: "2025-01-27.acacia", typescript: true });
    }
    return (_stripe as never)[prop];
  },
});

// ── Plan definitions ───────────────────────────────────────
export const PLANS = {
  STARTER: {
    name:        "Starter",
    description: "Para barbearias que estão começando",
    priceId:     process.env.STRIPE_PRICE_STARTER_MONTHLY ?? "",
    monthlyBRL:  9700,
    features: [
      "Sync com Trinks",
      "Dashboard diário",
      "Até 5 sugestões de IA por mês",
      "Painel de clientes",
      "1 usuário",
    ],
  },
  PRO: {
    name:        "Pro",
    description: "Para barbearias que querem crescer",
    priceId:     process.env.STRIPE_PRICE_PRO_MONTHLY ?? "",
    monthlyBRL:  19700,
    features: [
      "Tudo do Starter",
      "Sugestões de IA ilimitadas",
      "Campanhas e ofertas",
      "Sync automático",
      "Até 3 usuários",
      "Relatórios avançados",
    ],
    popular: true,
  },
  ENTERPRISE: {
    name:        "Enterprise",
    description: "Para redes e barbearias premium",
    priceId:     process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY ?? "",
    monthlyBRL:  39700,
    features: [
      "Tudo do Pro",
      "Multi-unidade",
      "API access",
      "Usuários ilimitados",
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
