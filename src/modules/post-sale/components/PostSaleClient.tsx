"use client";

import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/utils";
import type { CustomerSummary, PostSaleStatus } from "../types";
import {
  X, MessageCircle, Clock, Scissors,
  ChevronRight, Loader2, Lightbulb, CheckCircle2, AlertTriangle,
  UserMinus, RefreshCcw, Star, Phone, Send, ExternalLink, Sparkles,
} from "lucide-react";

// ── Status actions ────────────────────────────────────────────

interface ActionConfig {
  id:         string;
  label:      string;
  type:       string;
  icon:       React.ComponentType<{ className?: string }>;
  isReview?:  boolean; // needs Google review URL
}

const STATUS_ACTIONS: Record<PostSaleStatus, ActionConfig[]> = {
  RECENTE: [
    { id: "review", label: "Pedir avaliação Google", type: "post_sale_review", icon: Star, isReview: true },
  ],
  EM_RISCO: [
    { id: "reactivation", label: "Mensagem de reativação", type: "reactivation",       icon: MessageCircle },
    { id: "promo",        label: "Oferta especial",         type: "reactivation_promo", icon: Star },
  ],
  INATIVO: [
    { id: "reactivation", label: "Mensagem de reativação", type: "reactivation",       icon: MessageCircle },
    { id: "promo",        label: "Oferta especial",         type: "reactivation_promo", icon: Star },
  ],
  REATIVADO: [
    { id: "followup", label: "Mensagem de acompanhamento", type: "post_sale_followup", icon: MessageCircle },
    { id: "review",   label: "Pedir avaliação Google",     type: "post_sale_review",   icon: Star, isReview: true },
  ],
  NAO_CONTATAR: [],
};

function isActionDone(action: ActionConfig, customer: CustomerSummary): boolean {
  const sentTypes    = customer.sentTypes   ?? [];
  const reviewStatus = customer.reviewStatus ?? null;
  if (action.isReview) {
    return sentTypes.includes("post_sale_review") ||
      (reviewStatus !== null && reviewStatus !== "pendente");
  }
  return sentTypes.includes(action.type);
}

// ── Filter cards config ───────────────────────────────────────

type FilterKey = "emRisco" | "recentes" | "inativos" | "reativados";

const FILTER_CONFIG: {
  key: FilterKey; label: string; tooltip: string;
  icon: React.ReactNode; cardBorder: string; cardBg: string; numColor: string;
}[] = [
  {
    key: "emRisco", label: "Clientes em risco",
    tooltip: "Último atendimento entre 14 e 60 dias atrás, sem agendamento futuro. Risco de perda — contato imediato recomendado.",
    icon: <AlertTriangle className="h-4 w-4 text-orange-400" />,
    cardBorder: "border-orange-500/40", cardBg: "bg-orange-500/5", numColor: "text-orange-400",
  },
  {
    key: "recentes", label: "Recém-atendidos",
    tooltip: "Atendidos nos últimos 14 dias. Janela ideal para pedir avaliação e enviar mensagem de acompanhamento.",
    icon: <Clock className="h-4 w-4 text-blue-400" />,
    cardBorder: "border-blue-500/40", cardBg: "bg-blue-500/5", numColor: "text-blue-400",
  },
  {
    key: "inativos", label: "Inativos",
    tooltip: "Sem visita há mais de 60 dias. Alta prioridade para campanhas de reativação com oferta ou mensagem personalizada.",
    icon: <UserMinus className="h-4 w-4 text-red-400" />,
    cardBorder: "border-red-500/40", cardBg: "bg-red-500/5", numColor: "text-red-400",
  },
  {
    key: "reativados", label: "Reativados",
    tooltip: "Estavam inativos e voltaram nos últimos 60 dias. Continue o engajamento para fidelizá-los.",
    icon: <RefreshCcw className="h-4 w-4 text-green-400" />,
    cardBorder: "border-green-500/40", cardBg: "bg-green-500/5", numColor: "text-green-400",
  },
];

const FILTER_STATUS: Record<FilterKey, PostSaleStatus> = {
  emRisco:    "EM_RISCO",
  recentes:   "RECENTE",
  inativos:   "INATIVO",
  reativados: "REATIVADO",
};

// ── Lightbulb tooltip ─────────────────────────────────────────

function CriteriaTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOut(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOut);
    return () => document.removeEventListener("mousedown", onOut);
  }, [open]);

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        className="text-muted-foreground/70 hover:text-gold-400 transition-colors"
      >
        <Lightbulb className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-2 z-50 w-64 rounded-lg border border-border bg-card shadow-xl px-3 py-2.5 text-[11px] text-muted-foreground leading-relaxed">
          <div className="absolute bottom-full right-3 border-4 border-transparent border-b-border" />
          <div className="flex items-start gap-2">
            <Lightbulb className="h-3 w-3 text-gold-400 shrink-0 mt-0.5" />
            <p>{text}</p>
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(false); }}
              className="shrink-0 text-muted-foreground/50 hover:text-foreground ml-1">
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────

interface SummaryData {
  emRisco:    number;
  recentes:   number;
  inativos:   number;
  reativados: number;
}

interface Props {
  summary:         SummaryData;
  customers:       CustomerSummary[];
  googleReviewUrl: string | null;
}

// ── Root component ────────────────────────────────────────────

export function PostSaleClient({ summary, customers, googleReviewUrl }: Props) {
  const [active,           setActive]           = useState<FilterKey | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSummary | null>(null);

  const filteredCustomers = active
    ? customers.filter((c) => c.postSaleStatus === FILTER_STATUS[active])
    : customers;

  return (
    <div className="space-y-5">
      {/* Filter cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {FILTER_CONFIG.map((cfg) => {
          const isActive = active === cfg.key;
          const count    = summary[cfg.key];
          return (
            <button
              key={cfg.key}
              onClick={() => setActive((prev) => prev === cfg.key ? null : cfg.key)}
              className={`rounded-lg border text-left p-3 sm:p-4 transition-all focus:outline-none focus:ring-2 focus:ring-ring ${
                isActive
                  ? `${cfg.cardBorder} ${cfg.cardBg}`
                  : "border-border/60 bg-surface-900 hover:border-border"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className={`inline-flex items-center justify-center rounded-md border p-1 ${isActive ? cfg.cardBg : "bg-surface-800 border-border"}`}>
                    {cfg.icon}
                  </span>
                  <p className={`text-xs leading-tight ${isActive ? cfg.numColor : "text-muted-foreground"}`}>
                    {cfg.label}
                  </p>
                </div>
                <CriteriaTooltip text={cfg.tooltip} />
              </div>
              <p className={`text-2xl font-semibold tabular-nums ${isActive ? cfg.numColor : "text-foreground"}`}>
                {count}
              </p>
              {isActive && (
                <p className={`text-[10px] mt-1 ${cfg.numColor} opacity-70`}>filtro ativo · clique para limpar</p>
              )}
            </button>
          );
        })}
      </div>

      {/* Customer list */}
      <CustomerList
        rows={filteredCustomers}
        emptyMessage={active ? `Nenhum cliente em "${FILTER_CONFIG.find(c => c.key === active)?.label}".` : "Selecione um filtro acima para ver os clientes."}
        showAll={!active}
        onSelect={setSelectedCustomer}
      />

      {/* Detail drawer */}
      {selectedCustomer && (
        <CustomerDetailSheet
          customer={selectedCustomer}
          googleReviewUrl={googleReviewUrl}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </div>
  );
}

// ── Customer list ─────────────────────────────────────────────

function CustomerList({ rows, emptyMessage, showAll, onSelect }: {
  rows: CustomerSummary[];
  emptyMessage: string;
  showAll: boolean;
  onSelect: (c: CustomerSummary) => void;
}) {
  const display = showAll ? rows.slice(0, 30) : rows;

  if (display.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {showAll && (
        <p className="text-xs text-muted-foreground">
          Mostrando todos os clientes com status pós-venda. Clique em um filtro acima para ver por categoria.
        </p>
      )}
      {display.map((c) => {
        const actions   = STATUS_ACTIONS[c.postSaleStatus] ?? [];
        const doneCount = actions.filter((a) => isActionDone(a, c)).length;
        const allDone   = actions.length > 0 && doneCount === actions.length;
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c)}
            className="w-full rounded-lg border border-border/60 bg-surface-900 hover:border-border hover:bg-surface-800 transition-colors text-left"
          >
            <div className="px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 leading-5 ${statusBadgeClass(c.postSaleStatus)}`}>
                    {statusLabel(c.postSaleStatus)}
                  </Badge>
                  {allDone && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 leading-5 text-green-400 border-green-400/30">
                      ✓ FUP completo
                    </Badge>
                  )}
                </div>
                <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                {c.lastVisitAt && (
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Clock className="h-3 w-3 shrink-0" />
                    {relativeTime(c.lastVisitAt)}
                    {c.serviceName && ` · ${c.serviceName}`}
                  </p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Customer detail sheet ─────────────────────────────────────

function CustomerDetailSheet({ customer, googleReviewUrl, onClose }: {
  customer:        CustomerSummary;
  googleReviewUrl: string | null;
  onClose:         () => void;
}) {
  const [showActions,     setShowActions]     = useState(false);
  const [selectedAction,  setSelectedAction]  = useState<ActionConfig | null>(null);
  const [localCustomer,   setLocalCustomer]   = useState(customer);

  const actions = STATUS_ACTIONS[localCustomer.postSaleStatus] ?? [];
  const allDone = actions.length > 0 && actions.every((a) => isActionDone(a, localCustomer));

  function handleSent(action: ActionConfig) {
    setLocalCustomer((prev) => {
      const newTypes       = [...(prev.sentTypes ?? []), action.type];
      const newReviewStatus = action.isReview ? "enviado" : prev.reviewStatus;
      return { ...prev, sentTypes: newTypes, reviewStatus: newReviewStatus };
    });
    setSelectedAction(null);
    setShowActions(false);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-border bg-card shadow-xl max-h-[85vh] overflow-y-auto">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className={`text-[10px] ${statusBadgeClass(localCustomer.postSaleStatus)}`}>
                {statusLabel(localCustomer.postSaleStatus)}
              </Badge>
            </div>
            <h2 className="text-base font-semibold text-foreground">{localCustomer.name}</h2>
            {localCustomer.phone && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Phone className="h-3 w-3" />{localCustomer.phone}
              </p>
            )}
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-800 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pb-6 space-y-4">
          {/* Last visit */}
          <div className="rounded-lg border border-border/60 bg-surface-900 p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Último atendimento</p>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-500/10 border border-gold-500/20">
                <Scissors className="h-4 w-4 text-gold-400" />
              </div>
              <div>
                {localCustomer.serviceName
                  ? <p className="text-sm font-medium text-foreground">{localCustomer.serviceName}</p>
                  : <p className="text-sm text-muted-foreground italic">Serviço não registrado</p>
                }
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {localCustomer.lastVisitAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />{relativeTime(localCustomer.lastVisitAt)}
                    </span>
                  )}
                  {localCustomer.servicePrice != null && (
                    <span>· R$ {localCustomer.servicePrice.toFixed(2).replace(".", ",")}</span>
                  )}
                </div>
              </div>
            </div>
            {(localCustomer.ticketMedio != null || localCustomer.frequencia != null) && (
              <div className="flex gap-4 pt-1 border-t border-border/40">
                {localCustomer.ticketMedio != null && (
                  <div>
                    <p className="text-[10px] text-muted-foreground">Ticket médio</p>
                    <p className="text-xs font-medium text-foreground">R$ {localCustomer.ticketMedio.toFixed(2).replace(".", ",")}</p>
                  </div>
                )}
                {localCustomer.frequencia != null && (
                  <div>
                    <p className="text-[10px] text-muted-foreground">Visitas totais</p>
                    <p className="text-xs font-medium text-foreground">{localCustomer.frequencia}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* FUP status */}
          {actions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Follow-up</p>

              {actions.filter((a) => isActionDone(a, localCustomer)).length > 0 && (
                <div className="space-y-1.5">
                  {actions.filter((a) => isActionDone(a, localCustomer)).map((a) => (
                    <div key={a.id} className="flex items-center gap-2 rounded-md border border-green-500/20 bg-green-500/5 px-3 py-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
                      <span className="text-xs text-green-400">{a.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {allDone ? (
                <div className="rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-3 text-center">
                  <p className="text-sm font-medium text-green-400">FUP completo</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Todas as ações foram realizadas para este atendimento.</p>
                </div>
              ) : (
                <Button className="w-full gap-2" onClick={() => setShowActions(true)}>
                  <MessageCircle className="h-4 w-4" />
                  Enviar mensagem
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {showActions && (
        <ActionSheet
          customer={localCustomer}
          actions={actions.filter((a) => !isActionDone(a, localCustomer))}
          onClose={() => setShowActions(false)}
          onAction={(a) => { setSelectedAction(a); setShowActions(false); }}
        />
      )}

      {selectedAction && (
        selectedAction.isReview && !googleReviewUrl ? (
          <MissingReviewUrlModal
            onClose={() => setSelectedAction(null)}
          />
        ) : (
          <AiWhatsAppModal
            customer={localCustomer}
            action={selectedAction}
            googleReviewUrl={googleReviewUrl}
            onClose={() => setSelectedAction(null)}
            onSent={() => handleSent(selectedAction)}
          />
        )
      )}
    </>
  );
}

// ── Action sheet ──────────────────────────────────────────────

function ActionSheet({ customer, actions, onClose, onAction }: {
  customer: CustomerSummary;
  actions:  ActionConfig[];
  onClose:  () => void;
  onAction: (a: ActionConfig) => void;
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-border bg-card shadow-xl">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        <div className="px-5 pt-2 pb-8">
          <p className="text-xs text-muted-foreground mb-4">
            O que deseja enviar para <span className="text-foreground font-medium">{customer.name}</span>?
          </p>
          <div className="space-y-2">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <button key={action.id} onClick={() => onAction(action)}
                  className="w-full flex items-center gap-3 rounded-lg border border-purple-500/20 bg-purple-500/5 hover:border-purple-500/40 hover:bg-purple-500/10 px-4 py-3 text-sm text-left transition-colors"
                >
                  <Icon className="h-4 w-4 text-purple-400 shrink-0" />
                  <span className="flex-1 text-foreground">{action.label}</span>
                  <Sparkles className="h-3.5 w-3.5 text-purple-400/60" />
                </button>
              );
            })}
          </div>
          <Button variant="ghost" className="w-full mt-3 text-muted-foreground" onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </>
  );
}

// ── Missing review URL modal ───────────────────────────────────

function MissingReviewUrlModal({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-[60]" onClick={onClose} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[70] rounded-xl border border-amber-500/30 bg-card shadow-2xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20 shrink-0">
            <Star className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Link do Google não configurado</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Para enviar pedidos de avaliação, cadastre o link da sua página do Google Business nas configurações.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 text-xs" onClick={onClose}>Fechar</Button>
          <Button
            className="flex-1 text-xs gap-1.5 bg-gold-500 hover:bg-gold-400 text-black"
            onClick={() => { window.location.href = "/settings"; }}
          >
            <ExternalLink className="h-3.5 w-3.5" /> Ir para configurações
          </Button>
        </div>
      </div>
    </>
  );
}

// ── AI WhatsApp modal ─────────────────────────────────────────

function AiWhatsAppModal({ customer, action, googleReviewUrl, onClose, onSent }: {
  customer:        CustomerSummary;
  action:          ActionConfig;
  googleReviewUrl: string | null;
  onClose:         () => void;
  onSent:          () => void;
}) {
  const [message,   setMessage]   = useState("");
  const [loading,   setLoading]   = useState(true);
  const [sending,   setSending]   = useState(false);
  const [error,     setError]     = useState("");

  const daysSinceVisit = customer.lastVisitAt
    ? Math.floor((Date.now() - new Date(customer.lastVisitAt).getTime()) / 86_400_000)
    : undefined;

  useEffect(() => {
    async function generate() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/post-sale/generate-message", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            actionType:      action.type,
            customerName:    customer.name,
            serviceName:     customer.serviceName ?? undefined,
            daysSinceVisit,
            googleReviewUrl: action.isReview ? googleReviewUrl : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.message ?? data.error ?? "Erro ao gerar mensagem.");
          return;
        }
        setMessage(data.message);
      } catch {
        setError("Erro ao gerar mensagem. Tente novamente.");
      } finally {
        setLoading(false);
      }
    }
    generate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSend() {
    if (!customer.phone || !message.trim()) return;
    setSending(true);
    setError("");

    // Format phone: digits only, add 55 prefix if needed
    const digits = customer.phone.replace(/\D/g, "");
    const waPhone = digits.startsWith("55") ? digits : `55${digits}`;

    try {
      // Record as manually sent in the queue
      await fetch("/api/whatsapp/messages", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          customerId:   customer.id,
          customerName: customer.name,
          phone:        customer.phone,
          message:      message.trim(),
          type:         action.type,
          messageKind:  "text",
          sentManually: true,
        }),
      });

      // Open WhatsApp with pre-filled message
      window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(message.trim())}`, "_blank");
      onSent();
    } catch {
      setError("Erro ao registrar mensagem.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-[60]" onClick={onClose} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[70] rounded-xl border border-border bg-card shadow-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <Sparkles className="h-3.5 w-3.5 text-purple-400" />
              <h3 className="text-sm font-semibold text-foreground">{action.label}</h3>
            </div>
            <p className="text-xs text-muted-foreground">{customer.name}</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
            <p className="text-xs text-muted-foreground">Gerando mensagem com IA...</p>
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-3 text-xs text-red-400 space-y-2">
            <p>{error}</p>
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={onClose}>Fechar</Button>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Mensagem gerada</label>
                <span className="text-[10px] text-purple-400/70 flex items-center gap-1">
                  <Sparkles className="h-2.5 w-2.5" /> IA
                </span>
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                className="w-full rounded-lg border border-purple-500/20 bg-purple-500/5 px-3 py-2.5 text-sm text-foreground leading-relaxed focus:outline-none focus:ring-2 focus:ring-purple-500/40 resize-none"
              />
            </div>

            {!customer.phone && (
              <p className="text-xs text-amber-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Cliente sem telefone cadastrado.
              </p>
            )}

            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onClose} disabled={sending}>Cancelar</Button>
              <Button
                className="flex-1 gap-2 bg-purple-600 hover:bg-purple-500 text-white"
                disabled={!customer.phone || !message.trim() || sending}
                onClick={handleSend}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Abrir WhatsApp
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────

function statusLabel(s: string) {
  const map: Record<string, string> = {
    RECENTE: "Recente", EM_RISCO: "Em risco", INATIVO: "Inativo",
    REATIVADO: "Reativado", NAO_CONTATAR: "Não contatar",
  };
  return map[s] ?? s;
}

function statusBadgeClass(s: string) {
  const map: Record<string, string> = {
    RECENTE:      "text-emerald-400 border-emerald-400/30",
    EM_RISCO:     "text-amber-400 border-amber-400/30",
    INATIVO:      "text-red-400 border-red-400/30",
    REATIVADO:    "text-blue-400 border-blue-400/30",
    NAO_CONTATAR: "text-muted-foreground",
  };
  return map[s] ?? "";
}

