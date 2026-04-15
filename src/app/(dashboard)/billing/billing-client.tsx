"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sparkles, Zap, CheckCircle2, XCircle, CreditCard, Loader2, AlertTriangle, Receipt, Info, Lock } from "lucide-react";
import type { PlanTier, SubscriptionStatus } from "@prisma/client";

// ── Plan display config ──────────────────────────────────────────────────────

const PLAN_INFO: Record<PlanTier, { label: string; color: string; badgeClass: string }> = {
  FREE:       { label: "Free",          color: "text-muted-foreground", badgeClass: "text-muted-foreground border-border/60"   },
  STARTER:    { label: "Profissional",  color: "text-gold-400",         badgeClass: "text-gold-400 border-gold-500/30"         },
  PRO:        { label: "Profissional",  color: "text-gold-400",         badgeClass: "text-gold-400 border-gold-500/30"         },
  ENTERPRISE: { label: "Enterprise",   color: "text-purple-400",       badgeClass: "text-purple-400 border-purple-400/30"     },
};

const PLAN_PRICE: Record<PlanTier, string> = {
  FREE:       "Grátis",
  STARTER:    "R$49,90/mês",
  PRO:        "R$49,90/mês",
  ENTERPRISE: "Personalizado",
};

const PLAN_AI_LABEL: Record<PlanTier, string> = {
  FREE:       "50 chamadas totais (trial)",
  STARTER:    "300 créditos/mês",
  PRO:        "300 créditos/mês",
  ENTERPRISE: "Ilimitado",
};

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  planTier:           PlanTier;
  planStatus:         SubscriptionStatus;
  aiUsed:             number;
  aiLimit:            number;
  aiCreditsRemaining: number;
  aiCreditsPurchased: number;
  yearMonth:          string;
  stripeCustomerId:   string | null;
  featureMatrix:      Record<string, Record<string, boolean>>;
  allFeatures:        { key: string; label: string }[];
  trialEndsAt:        string | null;
  currentPeriodEnd:   string | null;
  cancelAtPeriodEnd:  boolean;
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

const COMPARISON_TIERS: PlanTier[] = ["FREE", "PRO"];

const TIER_STYLE: Record<string, { label: string; badge: string; highlight: boolean }> = {
  FREE: { label: "Free",          badge: "text-muted-foreground border-border/60", highlight: false },
  PRO:  { label: "Profissional",  badge: "text-gold-400 border-gold-500/30",        highlight: true  },
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
  campaigns:     "Crie campanhas de marketing completas: texto gerado por IA com base no seu objetivo, imagem criada automaticamente e publicação direta no Instagram. Programe a data de lançamento e acompanhe o status.",
  vitrine:       "Poste carrosséis dos seus melhores cortes no Instagram. Envie até 3 fotos por post, gere a legenda com IA (1 crédito) e publique direto pelo app. Disponível em todos os planos.",
  whatsapp:      "Envie mensagens de WhatsApp para clientes individualmente usando templates ou texto livre. Gerencie a fila de mensagens agendadas, veja o histórico de enviadas e acompanhe falhas de entrega.",
  whatsapp_auto: "Bot que processa a fila de templates de WhatsApp automaticamente a cada 15 minutos — sem você precisar fazer nada. Ideal para pós-venda, reativação de inativos e campanhas em massa.",
  "post-sale":   "Painel de retenção com clientes segmentados por risco: em risco de sair (14–60 dias sem visita), recém-atendidos (janela ideal para pedir avaliação), inativos há mais de 60 dias e clientes reativados. Acione mensagens com um clique.",
  settings:      "Configure os dados da barbearia, conecte com a Trinks (chave de API), integre o WhatsApp Business (token e Phone ID), conecte o Instagram e gerencie preferências gerais do sistema.",
  billing:       "Acompanhe seu plano atual, uso de IA, próxima fatura estimada e histórico de cobranças. Gerencie assinatura e dados de pagamento pelo portal da Stripe.",
};

// Componente separado para evitar Suspense boundary na página inteira
function CreditsAddedRefresher() {
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get("credits") === "added") {
      window.dispatchEvent(new Event("ai-used"));
    }
  }, [searchParams]);
  return null;
}

export function BillingClient({
  planTier,
  planStatus,
  aiUsed,
  aiLimit,
  aiCreditsRemaining,
  aiCreditsPurchased,
  yearMonth,
  stripeCustomerId,
  featureMatrix,
  allFeatures,
  trialEndsAt,
  currentPeriodEnd,
  cancelAtPeriodEnd,
  priceIdPro,
}: Props) {
  const [loadingCredits,   setLoadingCredits]   = useState(false);
  const [loadingPortal,    setLoadingPortal]    = useState(false);
  const [loadingCheckout,  setLoadingCheckout]  = useState<string | null>(null);
  const [checkoutError,    setCheckoutError]    = useState("");
  const [expandedFeature,  setExpandedFeature]  = useState<string | null>(null);

  const info   = PLAN_INFO[planTier];
  const aiPct  = aiLimit > 0 ? Math.min(100, Math.round((aiUsed / aiLimit) * 100)) : 100;

  const isTrialing = planStatus === "TRIALING";
  const isManaged =
    !!stripeCustomerId &&
    (planStatus === "ACTIVE" || planStatus === "TRIALING" || planStatus === "PAST_DUE");
  const canUpgrade = !isManaged;
  const periodEndFormatted = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
    : null;

  async function buyCredits() {
    setLoadingCredits(true);
    try {
      const res  = await fetch("/api/billing/credits/checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
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
      const data = await res.json();
      if (!res.ok) {
        setCheckoutError(data.error ?? "Erro ao iniciar checkout. Tente novamente.");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
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
    <div className="flex-1 overflow-hidden flex flex-col">
      <Suspense fallback={null}><CreditsAddedRefresher /></Suspense>
      <Tabs defaultValue="plano" className="flex-1 flex flex-col min-h-0">
        <div className="px-4 md:px-6 pt-4 md:pt-6 shrink-0">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="plano">Plano</TabsTrigger>
            <TabsTrigger value="extrato">Extrato</TabsTrigger>
            <TabsTrigger value="comparar">Comparar planos</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="plano" className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 max-w-2xl min-h-0">
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
                <p className="text-2xl font-bold text-gold-400">Gratuito</p>
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

        {/* Trial info */}
        {isTrialing && (
          <div className="flex items-center gap-2 rounded-lg border border-gold-500/20 bg-gold-500/5 px-3 py-2.5">
            <Sparkles className="h-4 w-4 text-gold-400 shrink-0" />
            <p className="text-sm text-muted-foreground">Acesso gratuito por 7 dias. Ao expirar, escolha um plano para continuar com a IA.</p>
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
        </div>

        {/* CTA principal de assinatura */}
        {isManaged && (
          <Button variant="outline" className="w-full gap-2" onClick={openPortal} disabled={loadingPortal}>
            {loadingPortal ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            Gerenciar assinatura
          </Button>
        )}
        {canUpgrade && (
          <div className="space-y-2 pt-1">
            <Button
              className="w-full gap-1"
              disabled={!priceIdPro || loadingCheckout !== null}
              onClick={() => subscribe(priceIdPro)}
            >
              {loadingCheckout === priceIdPro ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Assinar Profissional — R$49,90/mês
            </Button>
            {checkoutError && <p className="text-xs text-red-400">{checkoutError}</p>}
          </div>
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
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{aiUsed} de {aiLimit} chamadas usadas no trial</span>
              {aiUsed >= aiLimit
                ? <span className="text-red-400 font-medium">Esgotado</span>
                : <span className="text-emerald-400">{aiLimit - aiUsed} restantes</span>
              }
            </div>
            <div className="h-2 rounded-full bg-surface-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  aiUsed >= aiLimit ? "bg-red-500" : aiUsed / aiLimit >= 0.7 ? "bg-amber-500" : "bg-gold-500"
                }`}
                style={{ width: `${Math.min(100, Math.round((aiUsed / aiLimit) * 100))}%` }}
              />
            </div>
            {aiUsed >= aiLimit ? (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2.5">
                <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Limite do trial atingido. Assine um plano para continuar usando a IA.
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Ao esgotar as {aiLimit} chamadas do trial, a conta migra automaticamente para o plano <span className="text-foreground font-medium">Free</span> (sem IA).
              </p>
            )}

            {/* Créditos comprados durante o trial */}
            {aiCreditsRemaining > 0 && (
              <div className="space-y-1.5 border-t border-border/40 pt-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Zap className="h-3 w-3 text-purple-400" />
                    <span>Comprados</span>
                  </div>
                  <span className="text-purple-400 font-semibold">{aiCreditsRemaining} disponíveis</span>
                </div>
                <div className="h-2 rounded-full bg-surface-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-purple-500 transition-all"
                    style={{ width: `${Math.min(100, Math.round(((aiCreditsPurchased - aiCreditsRemaining) / Math.max(1, aiCreditsPurchased)) * 100))}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">Não expiram — ativados automaticamente quando o trial esgotar</p>
              </div>
            )}
          </div>
        ) : (
        <div className="space-y-3">
          {/* FREE: sem créditos mensais — aviso de upgrade */}
          {planTier === "FREE" ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span className="text-xs font-semibold text-amber-400">Plano Free — sem créditos mensais</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                O plano Free não inclui créditos mensais. Você pode comprar créditos avulsos para usar as funcionalidades disponíveis, ou fazer upgrade para ter acesso completo.
              </p>
            </div>
          ) : (
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>{aiUsed} de {aiLimit === Infinity ? "∞" : aiLimit} chamadas usadas</span>
              <span className={aiPct >= 90 ? "text-red-400 font-medium" : "text-muted-foreground"}>
                {aiPct >= 100 ? "Esgotado" : `${100 - aiPct}% restante`}
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  aiPct >= 90 ? "bg-red-500" : aiPct >= 70 ? "bg-amber-500" : "bg-gold-500"
                }`}
                style={{ width: `${aiPct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Renova todo mês com o plano</p>
          </div>
          )}

          {/* Barra de créditos extras (reserva) */}
          {aiCreditsRemaining > 0 && (
            <div className="space-y-1.5 border-t border-border/40 pt-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Zap className="h-3 w-3 text-purple-400" />
                  <span>Comprados</span>
                </div>
                <span className="text-purple-400 font-semibold">{aiCreditsRemaining} disponíveis</span>
              </div>
              <div className="h-2 rounded-full bg-surface-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-purple-500 transition-all"
                  style={{ width: `${Math.min(100, Math.round(((aiCreditsPurchased - aiCreditsRemaining) / Math.max(1, aiCreditsPurchased)) * 100))}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">Não expiram — ativados automaticamente quando o plano mensal esgotar</p>
            </div>
          )}

          {/* Aviso quando plano esgotado e sem reserva */}
          {aiPct >= 100 && aiCreditsRemaining === 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2.5">
              <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Limite atingido — adicione créditos para continuar usando a IA.
              </p>
            </div>
          )}
        </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={buyCredits}
          disabled={loadingCredits}
        >
          {loadingCredits ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 shrink-0 text-gold-400" />}
          <span className="truncate">Comprar créditos — R$20 <span className="hidden sm:inline">(+200 chamadas)</span><span className="sm:hidden">+200 chamadas</span></span>
        </Button>
      </div>

        </TabsContent>

        {/* ── Extrato tab ─────────────────────────────────────────────── */}
        <TabsContent value="extrato" className="flex-1 overflow-y-auto p-4 md:p-6 max-w-2xl min-h-0">
          <StatementSection planTier={planTier} planStatus={planStatus} yearMonth={yearMonth} />
        </TabsContent>

        {/* ── Comparar planos tab ──────────────────────────────────────── */}
        <TabsContent value="comparar" className="flex-1 overflow-y-auto p-4 md:p-6 max-w-2xl min-h-0">
          <div className="rounded-xl border border-border/60 bg-surface-900 overflow-hidden">
            <div className="px-4 md:px-5 py-4 border-b border-border/40">
              <p className="text-sm font-medium text-foreground">Comparativo de planos</p>
              <p className="text-xs text-muted-foreground mt-0.5">Clique em cada linha para ver o que é possível fazer</p>
            </div>
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
          </div>
        </TabsContent>

      </Tabs>
    </div>
  );
}

// ── Statement section ────────────────────────────────────────────────────────

interface StatementData {
  yearMonth:    string;
  subscription: { planTier: string; priceCents: number; renewsAt: string | null; cancelAtPeriodEnd: boolean };
  aiUsage:      { used: number; limit: number | null };
  credits:      { balance: number; purchased: number };
  callLog:      { id: string; label: string; credits: number; source: string; fromMonthly?: number; fromCredits?: number; createdAt: string }[];
  history:      { yearMonth: string; usageCount: number }[];
}

function formatYM(ym: string) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)   return "agora";
  if (mins < 60)  return `${mins}min atrás`;
  if (hours < 24) return `${hours}h atrás`;
  return `${days}d atrás`;
}

function StatementSection({ planTier, planStatus, yearMonth }: {
  planTier: PlanTier; planStatus: SubscriptionStatus; yearMonth: string;
}) {
  const [data,    setData]    = useState<StatementData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/billing/statement")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const isActive = planStatus === "ACTIVE" && planTier !== "FREE";

  return (
    <div className="space-y-4">
      {/* Subscription card */}
      <div className="rounded-xl border border-border/60 bg-surface-900 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-gold-400" />
          <span className="text-sm font-medium text-foreground">Assinatura</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : isActive && data ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Plano Profissional</span>
              <span className="text-sm font-semibold text-gold-400">R$49,90/mês</span>
            </div>
            {data.subscription.renewsAt && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Próxima renovação</span>
                <span>{new Date(data.subscription.renewsAt).toLocaleDateString("pt-BR")}</span>
              </div>
            )}
            {data.subscription.cancelAtPeriodEnd && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">
                Cancelamento agendado para o fim do período.
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {planStatus === "TRIALING" ? "Trial ativo — assinatura começa ao contratar um plano." : "Sem assinatura ativa."}
          </p>
        )}
      </div>

      {/* AI usage this month */}
      {data && (
        <div className="rounded-xl border border-border/60 bg-surface-900 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-gold-400" />
              <span className="text-sm font-medium text-foreground">IA — {formatYM(yearMonth)}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {data.aiUsage.used} / {data.aiUsage.limit ?? "∞"} créditos
            </span>
          </div>
          {data.aiUsage.limit !== null && (
            <div className="h-2 rounded-full bg-surface-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  data.aiUsage.used >= data.aiUsage.limit ? "bg-red-500"
                  : data.aiUsage.used / data.aiUsage.limit >= 0.8 ? "bg-amber-500"
                  : "bg-gold-500"
                }`}
                style={{ width: `${Math.min(100, Math.round((data.aiUsage.used / Math.max(1, data.aiUsage.limit)) * 100))}%` }}
              />
            </div>
          )}
          {data.credits.balance > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/40 pt-2">
              <div className="flex items-center gap-1.5">
                <Zap className="h-3 w-3 text-purple-400" />
                <span>Créditos avulsos</span>
              </div>
              <span className="text-purple-400 font-semibold">{data.credits.balance} disponíveis</span>
            </div>
          )}

          {/* Call log */}
          {data.callLog.length > 0 && (
            <div className="space-y-1 border-t border-border/40 pt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Últimas chamadas</p>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
                  <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />Mensal</span>
                  <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-purple-500 inline-block" />Comprado</span>
                </div>
              </div>
              {data.callLog.map((c) => {
                const isCredits = c.source === "credits";
                const isMixed   = c.source === "mixed";
                const dotColor  = isCredits ? "bg-purple-500" : isMixed ? "bg-purple-400" : "bg-red-500";
                const creditColor = (isCredits || isMixed) ? "text-purple-400" : "text-red-400";
                return (
                  <div key={c.id} className="flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColor}`} />
                      <span className="text-muted-foreground truncate">{c.label}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={creditColor}>{c.credits} cr.</span>
                      <span className="text-muted-foreground/40">{formatRelative(c.createdAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Usage history */}
      {data && data.history.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-surface-900 overflow-hidden">
          <div className="px-5 py-3 border-b border-border/40">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Histórico de uso de IA</p>
          </div>
          <div className="divide-y divide-border/20">
            {data.history.map((h) => (
              <div key={h.yearMonth} className="flex items-center justify-between px-5 py-2.5">
                <span className="text-sm text-foreground capitalize">{formatYM(h.yearMonth)}</span>
                <span className="text-xs text-muted-foreground">{h.usageCount} créditos usados</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
