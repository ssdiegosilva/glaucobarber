"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Zap, CheckCircle2, XCircle, TrendingUp, CreditCard, Loader2, Clock, AlertTriangle } from "lucide-react";
import type { PlanTier, SubscriptionStatus } from "@prisma/client";

// ── Plan display config ──────────────────────────────────────────────────────

const PLAN_INFO: Record<PlanTier, { label: string; color: string; badgeClass: string }> = {
  FREE:       { label: "Free",       color: "text-muted-foreground", badgeClass: "text-muted-foreground border-border/60"       },
  STARTER:    { label: "Start",      color: "text-blue-400",         badgeClass: "text-blue-400 border-blue-400/30"             },
  PRO:        { label: "Pro",        color: "text-gold-400",         badgeClass: "text-gold-400 border-gold-500/30"             },
  ENTERPRISE: { label: "Enterprise", color: "text-purple-400",       badgeClass: "text-purple-400 border-purple-400/30"         },
};

const PLAN_PRICE: Record<PlanTier, string> = {
  FREE:       "Grátis",
  STARTER:    "R$89/mês",
  PRO:        "R$149/mês + R$1,50/atendimento",
  ENTERPRISE: "Personalizado",
};

const PLAN_AI_LABEL: Record<PlanTier, string> = {
  FREE:       "30 chamadas totais (trial vitalício)",
  STARTER:    "50 chamadas/mês",
  PRO:        "300 chamadas/mês",
  ENTERPRISE: "Ilimitado",
};

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  planTier:           PlanTier;
  planStatus:         SubscriptionStatus;
  aiUsed:             number;
  aiLimit:            number;
  aiCreditsRemaining: number;
  appointmentCount:   number;
  appointmentCents:   number;
  appointmentFeeCents: number;
  appointmentCapCents: number;
  hasAppointmentFee:  boolean;
  yearMonth:          string;
  stripeCustomerId:   string | null;
  featureMatrix:      Record<string, Record<string, boolean>>;
  allFeatures:        { key: string; label: string }[];
  trialEndsAt:        string | null;
  currentPeriodEnd:   string | null;
  cancelAtPeriodEnd:  boolean;
}

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatYearMonth(ym: string) {
  const [y, m] = ym.split("-");
  const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

// ── Component ────────────────────────────────────────────────────────────────

const COMPARISON_TIERS: PlanTier[] = ["FREE", "STARTER", "PRO"];

const TIER_STYLE: Record<string, { label: string; badge: string; highlight: boolean }> = {
  FREE:    { label: "Free",  badge: "text-muted-foreground border-border/60", highlight: false },
  STARTER: { label: "Start", badge: "text-blue-400 border-blue-400/30",       highlight: false },
  PRO:     { label: "Pro",   badge: "text-gold-400 border-gold-500/30",        highlight: true  },
};

export function BillingClient({
  planTier,
  planStatus,
  aiUsed,
  aiLimit,
  aiCreditsRemaining,
  appointmentCount,
  appointmentCents,
  appointmentFeeCents,
  appointmentCapCents,
  hasAppointmentFee,
  yearMonth,
  stripeCustomerId,
  featureMatrix,
  allFeatures,
  trialEndsAt,
  currentPeriodEnd,
  cancelAtPeriodEnd,
}: Props) {
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [loadingPortal,  setLoadingPortal]  = useState(false);

  const info       = PLAN_INFO[planTier];
  const totalAi    = aiLimit + aiCreditsRemaining;
  const aiPct      = totalAi > 0 ? Math.min(100, Math.round((aiUsed / totalAi) * 100)) : 100;
  const capCents   = appointmentCapCents;
  const apptPct    = hasAppointmentFee ? Math.min(100, Math.round((appointmentCents / capCents) * 100)) : 0;

  const isTrialing = planStatus === "TRIALING";
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;
  const periodEndFormatted = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
    : null;

  async function buyCredits() {
    setLoadingCredits(true);
    try {
      const res = await fetch("/api/billing/credits/checkout", { method: "POST" });
      if (res.redirected) window.location.href = res.url;
    } finally {
      setLoadingCredits(false);
    }
  }

  async function openPortal() {
    setLoadingPortal(true);
    try {
      const res  = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setLoadingPortal(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5 max-w-2xl">
      {/* Current plan */}
      <div className="rounded-xl border border-border/60 bg-surface-900 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Plano atual</span>
              {isTrialing ? (
                <Badge variant="outline" className="text-[11px] px-2 text-gold-400 border-gold-500/30">Trial</Badge>
              ) : (
                <Badge variant="outline" className={`text-[11px] px-2 ${info.badgeClass}`}>{info.label}</Badge>
              )}
              {planStatus === "ACTIVE" && !cancelAtPeriodEnd && (
                <Badge variant="outline" className="text-[11px] text-emerald-400 border-emerald-400/30">Ativo</Badge>
              )}
              {planStatus === "PAST_DUE" && (
                <Badge variant="outline" className="text-[11px] text-red-400 border-red-400/30">Pagamento pendente</Badge>
              )}
            </div>
            {isTrialing ? (
              <>
                <p className="text-2xl font-bold text-gold-400">Trial gratuito</p>
                <p className="text-sm text-muted-foreground">Acesso completo a todos os recursos</p>
              </>
            ) : (
              <>
                <p className={`text-2xl font-bold ${info.color}`}>{info.label}</p>
                <p className="text-sm text-muted-foreground">{PLAN_PRICE[planTier]}</p>
              </>
            )}
          </div>
          {stripeCustomerId && (
            <Button variant="outline" size="sm" onClick={openPortal} disabled={loadingPortal}>
              {loadingPortal ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              <span className="ml-1.5">Portal de cobrança</span>
            </Button>
          )}
        </div>

        {/* Trial countdown */}
        {isTrialing && trialEndsAt && (
          <div className="flex items-center gap-2 rounded-lg border border-gold-500/20 bg-gold-500/5 px-3 py-2.5">
            <Clock className="h-4 w-4 text-gold-400 shrink-0" />
            <div className="text-sm">
              <span className="text-gold-400 font-medium">
                {trialDaysLeft === 0 ? "Expira hoje" : `${trialDaysLeft} dia${trialDaysLeft !== 1 ? "s" : ""} restantes`}
              </span>
              <span className="text-muted-foreground"> — trial encerra em {new Date(trialEndsAt).toLocaleDateString("pt-BR")}. Após isso, migra para o plano Free.</span>
            </div>
          </div>
        )}

        {/* Pending plan change banner */}
        {cancelAtPeriodEnd && periodEndFormatted && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-amber-400 font-medium">Mudança de plano agendada</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                O plano atual permanece ativo até <span className="text-foreground">{periodEndFormatted}</span>. A alteração entra em vigor no próximo ciclo. Para reverter, use o Portal de cobrança.
              </p>
            </div>
          </div>
        )}

        {/* Features */}
        <div className="grid grid-cols-1 gap-1.5 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            {isTrialing ? (
              <span>IA ilimitada durante o trial</span>
            ) : (
              <span>{PLAN_AI_LABEL[planTier]} de IA</span>
            )}
          </div>
          {hasAppointmentFee && (
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-gold-400 shrink-0" />
              <span>{formatBRL(appointmentFeeCents)}/atendimento concluído (cap: {formatBRL(capCents)}/mês)</span>
            </div>
          )}
        </div>

        {/* Upgrade CTAs — hidden when there's already a pending Stripe change */}
        {!cancelAtPeriodEnd && (planTier === "FREE" || isTrialing) && (
          <div className="flex gap-2 pt-2">
            <form action="/api/stripe/checkout" method="POST" className="flex-1">
              <input type="hidden" name="priceId" value={process.env.NEXT_PUBLIC_STRIPE_PRICE_START ?? ""} />
              <Button type="submit" variant="outline" className="w-full">Assinar Start — R$89/mês</Button>
            </form>
            <form action="/api/stripe/checkout" method="POST" className="flex-1">
              <input type="hidden" name="priceId" value={process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO ?? ""} />
              <Button type="submit" className="w-full gap-1">
                <Sparkles className="h-4 w-4" />
                Assinar Pro — R$149/mês
              </Button>
            </form>
          </div>
        )}
        {!cancelAtPeriodEnd && planTier === "STARTER" && !isTrialing && (
          <form action="/api/stripe/checkout" method="POST">
            <input type="hidden" name="priceId" value={process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO ?? ""} />
            <Button type="submit" className="w-full gap-1">
              <Sparkles className="h-4 w-4" />
              Fazer upgrade para Pro — R$149/mês base
            </Button>
          </form>
        )}
      </div>

      {/* AI usage */}
      <div className="rounded-xl border border-border/60 bg-surface-900 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold-400" />
            <span className="text-sm font-medium text-foreground">Uso de IA</span>
          </div>
          {!isTrialing && <span className="text-xs text-muted-foreground">{formatYearMonth(yearMonth)}</span>}
        </div>

        {isTrialing ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Ilimitado durante o trial — aproveite para explorar todos os recursos.</span>
          </div>
        ) : (
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>{aiUsed} de {aiLimit === Infinity ? "∞" : aiLimit} chamadas usadas</span>
            {aiCreditsRemaining > 0 && (
              <span className="text-emerald-400">+{aiCreditsRemaining} créditos extras</span>
            )}
          </div>
          <div className="h-2 rounded-full bg-surface-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                aiPct >= 90 ? "bg-red-500" : aiPct >= 70 ? "bg-amber-500" : "bg-gold-500"
              }`}
              style={{ width: `${aiPct}%` }}
            />
          </div>
          <p className={`text-xs mt-1 ${aiPct >= 90 ? "text-red-400" : "text-muted-foreground"}`}>
            {aiPct >= 100 ? "Limite atingido — adicione créditos para continuar usando a IA." : `${100 - aiPct}% restante`}
          </p>
        </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={buyCredits}
          disabled={loadingCredits}
        >
          {loadingCredits ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 text-gold-400" />}
          Comprar pacote de créditos — R$29 (+60 chamadas)
        </Button>
      </div>

      {/* Plan comparison */}
      <div className="rounded-xl border border-border/60 bg-surface-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40">
          <p className="text-sm font-medium text-foreground">Comparativo de planos</p>
          <p className="text-xs text-muted-foreground mt-0.5">O que está incluso em cada plano</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left px-5 py-3 font-medium text-muted-foreground w-44">Funcionalidade</th>
                {COMPARISON_TIERS.map((tier) => (
                  <th key={tier} className="text-center px-4 py-3">
                    <Badge
                      variant="outline"
                      className={`text-[11px] ${TIER_STYLE[tier].badge} ${planTier === tier ? "ring-1 ring-offset-1 ring-current" : ""}`}
                    >
                      {TIER_STYLE[tier].label}
                    </Badge>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allFeatures
                .filter((f) => !["billing", "settings"].includes(f.key))
                .map((f, i) => (
                  <tr
                    key={f.key}
                    className={`border-b border-border/20 last:border-0 ${i % 2 === 0 ? "" : "bg-surface-800/20"}`}
                  >
                    <td className="px-5 py-2.5 text-muted-foreground">{f.label}</td>
                    {COMPARISON_TIERS.map((tier) => {
                      const enabled = featureMatrix[f.key]?.[tier] ?? true;
                      return (
                        <td key={tier} className="text-center px-4 py-2.5">
                          {enabled ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-400 mx-auto" />
                          ) : (
                            <XCircle className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Appointment billing (PRO only) */}
      {hasAppointmentFee && (
        <div className="rounded-xl border border-border/60 bg-surface-900 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-gold-400" />
            <span className="text-sm font-medium text-foreground">Taxa por atendimento</span>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <p className="text-2xl font-bold text-foreground">{formatBRL(appointmentCents)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {appointmentCount} atendimento{appointmentCount !== 1 ? "s" : ""} concluído{appointmentCount !== 1 ? "s" : ""} em {formatYearMonth(yearMonth)}
              </p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>Cap: {formatBRL(capCents)}/mês</p>
              <p>({formatBRL(appointmentFeeCents)}/atend.)</p>
            </div>
          </div>

          <div className="h-2 rounded-full bg-surface-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${apptPct >= 90 ? "bg-amber-500" : "bg-gold-500"}`}
              style={{ width: `${apptPct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {apptPct >= 100
              ? "Cap atingido — sem cobranças adicionais este mês."
              : `Falta ${formatBRL(capCents - appointmentCents)} para o cap mensal.`}
          </p>
          <p className="text-[11px] text-muted-foreground/70">
            Faturado automaticamente via Stripe no fechamento do ciclo mensal.
          </p>
        </div>
      )}
    </div>
  );
}
