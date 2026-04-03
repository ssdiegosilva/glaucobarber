"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Zap, CheckCircle2, XCircle, TrendingUp, CreditCard, Loader2, Clock, AlertTriangle, Receipt, ChevronDown, ChevronUp, Info } from "lucide-react";
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
  PRO:        "R$149/mês + R$1,00/atendimento",
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
  priceIdStart:       string;
  priceIdPro:         string;
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

// What you can do in each section — shown when user clicks a feature row
const FEATURE_DETAIL: Record<string, string> = {
  dashboard:     "Painel com indicadores do dia em tempo real: faturamento, atendimentos realizados, ticket médio, taxa de ocupação e sugestões automáticas da IA. Veja o que está acontecendo na sua barbearia sem precisar abrir a Trinks.",
  agenda:        "Visualize todos os agendamentos do dia com horário, cliente, serviço e status. Acompanhe o fluxo ao vivo, reagende ou cancele direto da plataforma — tudo sincronizado com a Trinks.",
  copilot:       "Assistente de IA que analisa os dados da barbearia e gera sugestões acionáveis: mensagens para clientes, oportunidades de promoção, insights de negócio e recomendações de serviço. Quanto mais você usa, mais personalizado fica.",
  financeiro:    "Relatórios de faturamento por dia, semana e mês. Compare períodos, identifique os serviços mais rentáveis, veja o ticket médio por cliente e monitore o crescimento da receita ao longo do tempo.",
  meta:          "Defina metas de faturamento e número de atendimentos para o dia e para o mês. Acompanhe o progresso com barra de status em tempo real e alertas quando você está perto de bater — ou em risco de não bater.",
  clients:       "Histórico completo de cada cliente: visitas, serviços realizados, ticket médio, última visita e status pós-venda. Filtre por inativos, em risco ou recém-atendidos para saber quem precisa de atenção.",
  services:      "Catálogo de serviços com nome, preço e duração. Veja quais serviços geram mais receita e quais têm melhor ticket médio. Sincronizado automaticamente com a Trinks.",
  offers:        "Crie promoções com validade, desconto e público-alvo. Use o Copilot para gerar o texto da oferta e acompanhe quantas vezes foi aplicada.",
  campaigns:     "Crie campanhas de marketing completas: texto gerado por IA com base no seu objetivo, imagem criada automaticamente e publicação direta no Instagram. Programe a data de lançamento e acompanhe o status.",
  whatsapp:      "Envie mensagens de WhatsApp para clientes individualmente usando templates ou texto livre. Gerencie a fila de mensagens agendadas, veja o histórico de enviadas e acompanhe falhas de entrega.",
  whatsapp_auto: "Bot que processa a fila de templates de WhatsApp automaticamente a cada 15 minutos — sem você precisar fazer nada. Ideal para pós-venda, reativação de inativos e campanhas em massa.",
  "post-sale":   "Painel de retenção com clientes segmentados por risco: em risco de sair (14–60 dias sem visita), recém-atendidos (janela ideal para pedir avaliação), inativos há mais de 60 dias e clientes reativados. Acione mensagens com um clique.",
  settings:      "Configure os dados da barbearia, conecte com a Trinks (chave de API), integre o WhatsApp Business (token e Phone ID), conecte o Instagram e gerencie preferências gerais do sistema.",
  billing:       "Acompanhe seu plano atual, uso de IA, próxima fatura estimada e histórico de cobranças. Gerencie assinatura e dados de pagamento pelo portal da Stripe.",
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
  priceIdStart,
  priceIdPro,
}: Props) {
  const [loadingCredits,   setLoadingCredits]   = useState(false);
  const [loadingPortal,    setLoadingPortal]    = useState(false);
  const [loadingCheckout,  setLoadingCheckout]  = useState<string | null>(null);
  const [checkoutError,    setCheckoutError]    = useState("");
  const [showComparison,   setShowComparison]   = useState(false);
  const [expandedFeature,  setExpandedFeature]  = useState<string | null>(null);

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

  async function subscribe(priceId: string) {
    setLoadingCheckout(priceId);
    setCheckoutError("");
    try {
      const body = new FormData();
      body.append("priceId", priceId);
      const res = await fetch("/api/stripe/checkout", { method: "POST", body });
      if (res.redirected) {
        window.location.href = res.url;
        return;
      }
      // fallback: try JSON error
      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        const data = await res.json();
        if (data.error) setCheckoutError(data.error);
      } else {
        setCheckoutError("Erro ao iniciar checkout. Tente novamente.");
      }
    } catch {
      setCheckoutError("Erro de conexão. Tente novamente.");
    } finally {
      setLoadingCheckout(null);
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
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 max-w-2xl">
      {/* Current plan */}
      <div className="rounded-xl border border-border/60 bg-surface-900 p-4 md:p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
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

        {/* CTA principal de assinatura */}
        {stripeCustomerId ? (
          /* Já tem cliente Stripe: tudo pelo portal (upgrade, downgrade, cancelar, pagamento) */
          <Button variant="outline" className="w-full gap-2" onClick={openPortal} disabled={loadingPortal}>
            {loadingPortal ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            Gerenciar assinatura no Stripe
          </Button>
        ) : !cancelAtPeriodEnd ? (
          /* Sem cliente Stripe: checkout para criar o customer e assinar */
          <div className="space-y-2 pt-1">
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline" className="flex-1"
                disabled={!priceIdStart || loadingCheckout !== null}
                onClick={() => subscribe(priceIdStart)}
              >
                {loadingCheckout === priceIdStart ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Assinar Start — R$89/mês
              </Button>
              <Button
                className="flex-1 gap-1"
                disabled={!priceIdPro || loadingCheckout !== null}
                onClick={() => subscribe(priceIdPro)}
              >
                {loadingCheckout === priceIdPro ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Assinar Pro — R$149/mês
              </Button>
            </div>
            {checkoutError && <p className="text-xs text-red-400">{checkoutError}</p>}
          </div>
        ) : null}
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
          aiUsed >= aiLimit ? (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2.5">
              <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="text-red-400 font-medium">Limite de uso do trial atingido</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Você explorou bastante durante o período gratuito. Assine um plano para continuar usando a IA.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>IA disponível durante o trial — aproveite para explorar todos os recursos.</span>
            </div>
          )
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

      {/* Plan comparison — collapsible */}
      <div className="rounded-xl border border-border/60 bg-surface-900 overflow-hidden">
        <button
          onClick={() => { setShowComparison((v) => !v); setExpandedFeature(null); }}
          className="w-full flex items-center justify-between px-4 md:px-5 py-4 hover:bg-surface-800/40 transition-colors text-left"
        >
          <div>
            <p className="text-sm font-medium text-foreground">Comparativo de planos</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {showComparison ? "Clique em cada linha para ver o que é possível fazer" : "Veja o que está incluso em cada plano"}
            </p>
          </div>
          {showComparison
            ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          }
        </button>

        {showComparison && (
          <div className="border-t border-border/40 overflow-x-auto">
            <table className="w-full text-sm min-w-[340px]">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Funcionalidade</th>
                  {COMPARISON_TIERS.map((tier) => (
                    <th key={tier} className="text-center px-3 py-3 w-16">
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
                  .map((f, i) => {
                    const isExpanded = expandedFeature === f.key;
                    const detail = FEATURE_DETAIL[f.key];
                    return (
                      <>
                        <tr
                          key={f.key}
                          onClick={() => setExpandedFeature(isExpanded ? null : f.key)}
                          className={`border-b border-border/20 cursor-pointer transition-colors ${
                            isExpanded
                              ? "bg-surface-800/60 border-border/40"
                              : i % 2 === 0 ? "hover:bg-surface-800/30" : "bg-surface-800/20 hover:bg-surface-800/40"
                          }`}
                        >
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-xs font-medium ${isExpanded ? "text-foreground" : "text-muted-foreground"}`}>
                                {f.label}
                              </span>
                              <Info className={`h-3 w-3 shrink-0 transition-colors ${isExpanded ? "text-gold-400" : "text-muted-foreground/40"}`} />
                            </div>
                          </td>
                          {COMPARISON_TIERS.map((tier) => {
                            const enabled = featureMatrix[f.key]?.[tier] ?? true;
                            return (
                              <td key={tier} className="text-center px-3 py-2.5">
                                {enabled ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-400 mx-auto" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                        {isExpanded && detail && (
                          <tr key={`${f.key}-detail`} className="border-b border-border/20 bg-surface-800/60">
                            <td colSpan={COMPARISON_TIERS.length + 1} className="px-4 py-3">
                              <p className="text-xs text-muted-foreground leading-relaxed">{detail}</p>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Statement (PRO only) */}
      {hasAppointmentFee && <StatementSection yearMonth={yearMonth} appointmentFeeCents={appointmentFeeCents} capCents={capCents} />}
    </div>
  );
}

// ── Statement section ────────────────────────────────────────────────────────

interface StatementEvent {
  id:           string;
  amountCents:  number;
  customerName: string;
  serviceName:  string;
  date:         string;
}
interface StatementHistory {
  yearMonth:   string;
  count:       number;
  totalCents:  number;
}
interface StatementData {
  yearMonth:         string;
  feeCents:          number;
  feeCap:            number;
  baseCents:         number;
  hasApptFee:        boolean;
  currentEvents:     StatementEvent[];
  currentTotalCents: number;
  cappedCents:       number;
  projectedCents:    number;
  history:           StatementHistory[];
}

function formatYM(ym: string) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function StatementSection({ yearMonth, appointmentFeeCents, capCents }: {
  yearMonth: string; appointmentFeeCents: number; capCents: number;
}) {
  const [tab,      setTab]      = useState<"current" | "history">("current");
  const [data,     setData]     = useState<StatementData | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch("/api/billing/statement")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const apptPct = data
    ? Math.min(100, Math.round((data.currentTotalCents / capCents) * 100))
    : 0;

  return (
    <div className="rounded-xl border border-border/60 bg-surface-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-gold-400" />
          <span className="text-sm font-medium text-foreground">Extrato de cobrança</span>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-800/50 p-0.5">
          <button
            onClick={() => setTab("current")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${tab === "current" ? "bg-gold-500/15 text-gold-400" : "text-muted-foreground hover:text-foreground"}`}
          >
            Mês atual
          </button>
          <button
            onClick={() => setTab("history")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${tab === "history" ? "bg-gold-500/15 text-gold-400" : "text-muted-foreground hover:text-foreground"}`}
          >
            Histórico
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !data ? null : tab === "current" ? (
        <div className="p-5 space-y-4">
          {/* Projected invoice */}
          <div className="rounded-lg border border-gold-500/20 bg-gold-500/5 p-4 space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Próxima fatura estimada</p>
            <p className="text-2xl font-bold text-gold-400">{formatBRL(data.projectedCents)}</p>
            <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
              <div className="flex justify-between">
                <span>Assinatura base</span>
                <span className="text-foreground">{formatBRL(data.baseCents)}</span>
              </div>
              <div className="flex justify-between">
                <span>Taxa atendimentos ({data.currentEvents.length} × {formatBRL(appointmentFeeCents)})</span>
                <span className={data.currentTotalCents > data.cappedCents ? "text-amber-400" : "text-foreground"}>
                  {formatBRL(data.cappedCents)}
                  {data.currentTotalCents > data.cappedCents && " (cap atingido)"}
                </span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{data.currentEvents.length} atendimento{data.currentEvents.length !== 1 ? "s" : ""} em {formatYM(yearMonth)}</span>
              <span>Cap: {formatBRL(capCents)}/mês</span>
            </div>
            <div className="h-2 rounded-full bg-surface-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${apptPct >= 100 ? "bg-amber-500" : "bg-gold-500"}`}
                style={{ width: `${apptPct}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {apptPct >= 100
                ? "Cap atingido — sem cobranças adicionais este mês."
                : `${formatBRL(capCents - data.currentTotalCents)} para o cap`}
            </p>
          </div>

          {/* Events list (collapsible) */}
          {data.currentEvents.length > 0 && (
            <div className="space-y-1.5">
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {expanded ? "Ocultar" : "Ver"} atendimentos cobrados
              </button>
              {expanded && (
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-surface-800/50">
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium">Cliente</th>
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium hidden sm:table-cell">Serviço</th>
                        <th className="text-right px-3 py-2 text-muted-foreground font-medium">Data</th>
                        <th className="text-right px-3 py-2 text-muted-foreground font-medium">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.currentEvents.map((e) => (
                        <tr key={e.id} className="hover:bg-surface-800/30">
                          <td className="px-3 py-2 text-foreground truncate max-w-[120px]">{e.customerName}</td>
                          <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">{e.serviceName}</td>
                          <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                            {new Date(e.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                          </td>
                          <td className="px-3 py-2 text-right text-gold-400 tabular-nums font-medium">{formatBRL(e.amountCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-border bg-surface-800/30">
                        <td colSpan={2} className="px-3 py-2 font-semibold text-foreground hidden sm:table-cell">Total</td>
                        <td className="px-3 py-2 font-semibold text-foreground sm:hidden">Total</td>
                        <td />
                        <td className="px-3 py-2 text-right tabular-nums font-bold text-gold-400">{formatBRL(data.currentTotalCents)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground/60">
            Faturado automaticamente via Stripe no fechamento do ciclo mensal. Valor estimado — pode variar até o fechamento.
          </p>
        </div>
      ) : (
        /* History tab */
        <div className="p-5 space-y-3">
          {data.history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum histórico faturado ainda.</p>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface-800/50">
                    <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">Mês</th>
                    <th className="text-right px-3 py-2.5 text-muted-foreground font-medium">Atendimentos</th>
                    <th className="text-right px-3 py-2.5 text-muted-foreground font-medium">Taxa</th>
                    <th className="text-right px-3 py-2.5 text-muted-foreground font-medium">Total fatura</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.history.map((h) => {
                    const capped = Math.min(h.totalCents, capCents);
                    return (
                      <tr key={h.yearMonth} className="hover:bg-surface-800/30">
                        <td className="px-3 py-2.5 text-foreground font-medium capitalize">{formatYM(h.yearMonth)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{h.count}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{formatBRL(capped)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-gold-400">{formatBRL(data.baseCents + capped)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground/60">Últimos 6 meses faturados. Acesse o Portal de cobrança para ver faturas completas da Stripe.</p>
        </div>
      )}
    </div>
  );
}
