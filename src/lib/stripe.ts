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
      "Trial com acesso completo por 7 dias",
      "Agenda ao vivo e gestão de clientes",
      "Metas e configurações básicas",
    ],
  },
  PRO: {
    name:        "Profissional",
    description: "Plano único — tudo desbloqueado",
    priceId:     process.env.STRIPE_PRICE_PRO_MONTHLY ?? "",
    monthlyBRL:  4990,            // R$49,90/mês
    features: [
      "300 créditos de IA por mês",
      "Copilot IA, campanhas e criar visual",
      "WhatsApp automático e pós-venda",
      "Relatórios financeiros completos",
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
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { price: priceId, quantity: 1 },
  ];

  const params: Stripe.Checkout.SessionCreateParams = {
    mode:                       "subscription",
    line_items:                 lineItems,
    success_url:                successUrl,
    cancel_url:                 cancelUrl,
    metadata:                   { barbershopId },
    locale:                     "pt-BR",
    allow_promotion_codes:      true,
    billing_address_collection: "auto",
    payment_method_types:       ["card", "boleto"],
    tax_id_collection:          { enabled: true },
    subscription_data: {
      metadata: { barbershopId },
    },
  };

  if (stripeCustomerId) {
    params.customer = stripeCustomerId;
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
