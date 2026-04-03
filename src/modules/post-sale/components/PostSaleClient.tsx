"use client";

import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/utils";
import type { CustomerSummary, PostSaleStatus } from "../types";
import {
  MessageCircle, Clock, Scissors,
  ChevronDown, ChevronUp, Loader2, Lightbulb, CheckCircle2, AlertTriangle,
  UserMinus, RefreshCcw, Star, Phone, Send, ExternalLink, Sparkles, X,
} from "lucide-react";

// ── Status actions ────────────────────────────────────────────

interface ActionConfig {
  id:         string;
  label:      string;
  type:       string;
  icon:       React.ComponentType<{ className?: string }>;
  isReview?:  boolean;
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
  const [active, setActive] = useState<FilterKey | null>(null);

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

      {/* Customer list — expandable inline */}
      <CustomerList
        rows={filteredCustomers}
        emptyMessage={active ? `Nenhum cliente em "${FILTER_CONFIG.find(c => c.key === active)?.label}".` : "Selecione um filtro acima para ver os clientes."}
        showAll={!active}
        googleReviewUrl={googleReviewUrl}
      />
    </div>
  );
}

// ── Customer list ─────────────────────────────────────────────

function CustomerList({ rows, emptyMessage, showAll, googleReviewUrl }: {
  rows:            CustomerSummary[];
  emptyMessage:    string;
  showAll:         boolean;
  googleReviewUrl: string | null;
}) {
  const [expandedId,    setExpandedId]    = useState<string | null>(null);
  const [localRows,     setLocalRows]     = useState<CustomerSummary[]>(rows);

  // keep in sync when rows prop changes (filter switch)
  useEffect(() => {
    setLocalRows(rows);
    setExpandedId(null);
  }, [rows]);

  const display = showAll ? localRows.slice(0, 30) : localRows;

  if (display.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  function handleSent(customerId: string, action: ActionConfig) {
    setLocalRows((prev) => prev.map((c) => {
      if (c.id !== customerId) return c;
      const newTypes        = [...(c.sentTypes ?? []), action.type];
      const newReviewStatus = action.isReview ? "enviado" : c.reviewStatus;
      return { ...c, sentTypes: newTypes, reviewStatus: newReviewStatus };
    }));
  }

  return (
    <div className="space-y-2">
      {showAll && (
        <p className="text-xs text-muted-foreground">
          Mostrando todos os clientes com status pós-venda. Clique em um filtro acima para ver por categoria.
        </p>
      )}
      {display.map((c) => (
        <CustomerRow
          key={c.id}
          customer={c}
          isExpanded={expandedId === c.id}
          onToggle={() => setExpandedId((prev) => prev === c.id ? null : c.id)}
          googleReviewUrl={googleReviewUrl}
          onSent={(action) => handleSent(c.id, action)}
        />
      ))}
    </div>
  );
}

// ── Customer row (expandable) ─────────────────────────────────

function CustomerRow({ customer, isExpanded, onToggle, googleReviewUrl, onSent }: {
  customer:        CustomerSummary;
  isExpanded:      boolean;
  onToggle:        () => void;
  googleReviewUrl: string | null;
  onSent:          (action: ActionConfig) => void;
}) {
  const rowRef                = useRef<HTMLDivElement>(null);
  const [composing, setComposing] = useState<ActionConfig | null>(null);
  const actions               = STATUS_ACTIONS[customer.postSaleStatus] ?? [];
  const doneCount             = actions.filter((a) => isActionDone(a, customer)).length;
  const allDone               = actions.length > 0 && doneCount === actions.length;

  // Scroll into view when expanded
  useEffect(() => {
    if (isExpanded) {
      setTimeout(() => rowRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
    } else {
      setComposing(null);
    }
  }, [isExpanded]);

  return (
    <div
      ref={rowRef}
      className={`rounded-lg border transition-colors ${
        isExpanded ? "border-border bg-surface-800/80" : "border-border/60 bg-surface-900 hover:border-border"
      }`}
    >
      {/* Collapsed header — always visible */}
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-center gap-3"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 leading-5 ${statusBadgeClass(customer.postSaleStatus)}`}>
              {statusLabel(customer.postSaleStatus)}
            </Badge>
            {allDone && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 leading-5 text-green-400 border-green-400/30">
                ✓ FUP completo
              </Badge>
            )}
          </div>
          <p className="text-sm font-medium text-foreground truncate">{customer.name}</p>
          {customer.lastVisitAt && (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Clock className="h-3 w-3 shrink-0" />
              {relativeTime(customer.lastVisitAt)}
              {customer.serviceName && ` · ${customer.serviceName}`}
            </p>
          )}
        </div>
        {isExpanded
          ? <ChevronUp   className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        }
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/40 pt-3">

          {/* Last visit card */}
          <div className="rounded-lg border border-border/60 bg-surface-900 p-3 space-y-2">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Último atendimento</p>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-500/10 border border-gold-500/20 shrink-0">
                <Scissors className="h-4 w-4 text-gold-400" />
              </div>
              <div className="min-w-0">
                {customer.serviceName
                  ? <p className="text-sm font-medium text-foreground truncate">{customer.serviceName}</p>
                  : <p className="text-sm text-muted-foreground italic">Serviço não registrado</p>
                }
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                  {customer.lastVisitAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />{relativeTime(customer.lastVisitAt)}
                    </span>
                  )}
                  {customer.servicePrice != null && (
                    <span>· R$ {customer.servicePrice.toFixed(2).replace(".", ",")}</span>
                  )}
                </div>
              </div>
            </div>
            {(customer.ticketMedio != null || customer.frequencia != null) && (
              <div className="flex gap-4 pt-1 border-t border-border/40">
                {customer.ticketMedio != null && (
                  <div>
                    <p className="text-[10px] text-muted-foreground">Ticket médio</p>
                    <p className="text-xs font-medium text-foreground">R$ {customer.ticketMedio.toFixed(2).replace(".", ",")}</p>
                  </div>
                )}
                {customer.frequencia != null && (
                  <div>
                    <p className="text-[10px] text-muted-foreground">Visitas totais</p>
                    <p className="text-xs font-medium text-foreground">{customer.frequencia}</p>
                  </div>
                )}
                {customer.phone && (
                  <div>
                    <p className="text-[10px] text-muted-foreground">Telefone</p>
                    <p className="text-xs font-medium text-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />{customer.phone}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* FUP actions */}
          {actions.length > 0 && (
            <div className="space-y-2">
              {/* Done actions */}
              {actions.filter((a) => isActionDone(a, customer)).map((a) => (
                <div key={a.id} className="flex items-center gap-2 rounded-md border border-green-500/20 bg-green-500/5 px-3 py-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
                  <span className="text-xs text-green-400">{a.label}</span>
                </div>
              ))}

              {allDone ? (
                <div className="rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-3 text-center">
                  <p className="text-sm font-medium text-green-400">FUP completo</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Todas as ações foram realizadas.</p>
                </div>
              ) : composing ? (
                /* Inline message composer */
                <MessageComposer
                  customer={customer}
                  action={composing}
                  googleReviewUrl={googleReviewUrl}
                  onCancel={() => setComposing(null)}
                  onSent={() => { onSent(composing); setComposing(null); }}
                />
              ) : (
                /* Pending action buttons */
                <div className="space-y-1.5">
                  {actions.filter((a) => !isActionDone(a, customer)).map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.id}
                        onClick={() => setComposing(action)}
                        className="w-full flex items-center gap-3 rounded-lg border border-purple-500/20 bg-purple-500/5 hover:border-purple-500/40 hover:bg-purple-500/10 px-4 py-3 text-sm text-left transition-colors"
                      >
                        <Icon className="h-4 w-4 text-purple-400 shrink-0" />
                        <span className="flex-1 text-foreground">{action.label}</span>
                        <Sparkles className="h-3.5 w-3.5 text-purple-400/60" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Inline message composer ───────────────────────────────────

function MessageComposer({ customer, action, googleReviewUrl, onCancel, onSent }: {
  customer:        CustomerSummary;
  action:          ActionConfig;
  googleReviewUrl: string | null;
  onCancel:        () => void;
  onSent:          () => void;
}) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error,   setError]   = useState("");

  const missingReviewUrl = action.isReview && !googleReviewUrl;

  const daysSinceVisit = customer.lastVisitAt
    ? Math.floor((Date.now() - new Date(customer.lastVisitAt).getTime()) / 86_400_000)
    : undefined;

  useEffect(() => {
    if (missingReviewUrl) { setLoading(false); return; }
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
        if (!res.ok) { setError(data.message ?? data.error ?? "Erro ao gerar mensagem."); return; }
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
    const digits  = customer.phone.replace(/\D/g, "");
    const waPhone = digits.startsWith("55") ? digits : `55${digits}`;
    try {
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
      window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(message.trim())}`, "_blank");
      onSent();
    } catch {
      setError("Erro ao registrar mensagem.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-purple-400" />
          <span className="text-xs font-medium text-foreground">{action.label}</span>
        </div>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Missing review URL */}
      {missingReviewUrl ? (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300 leading-relaxed">
              Configure o link do Google Business nas configurações para enviar pedidos de avaliação.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={onCancel}>Cancelar</Button>
            <Button size="sm" className="flex-1 text-xs gap-1.5 bg-gold-500 hover:bg-gold-400 text-black"
              onClick={() => { window.location.href = "/settings"; }}>
              <ExternalLink className="h-3 w-3" /> Ir para configurações
            </Button>
          </div>
        </div>
      ) : loading ? (
        <div className="flex items-center gap-2 py-4 justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
          <span className="text-xs text-muted-foreground">Gerando mensagem com IA...</span>
        </div>
      ) : error && !message ? (
        <div className="space-y-2">
          <p className="text-xs text-red-400">{error}</p>
          <Button size="sm" variant="outline" className="text-xs h-7" onClick={onCancel}>Fechar</Button>
        </div>
      ) : (
        <>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Mensagem gerada pela IA — edite se quiser</span>
              <span className="text-[10px] text-purple-400/70 flex items-center gap-1">
                <Sparkles className="h-2.5 w-2.5" /> IA
              </span>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="w-full rounded-lg border border-purple-500/20 bg-card px-3 py-2.5 text-sm text-foreground leading-relaxed focus:outline-none focus:ring-2 focus:ring-purple-500/40 resize-none"
            />
          </div>

          {!customer.phone && (
            <p className="text-xs text-amber-400 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Cliente sem telefone cadastrado.
            </p>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={onCancel} disabled={sending}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="flex-1 text-xs gap-1.5 bg-purple-600 hover:bg-purple-500 text-white"
              disabled={!customer.phone || !message.trim() || sending}
              onClick={handleSend}
            >
              {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              Abrir WhatsApp
            </Button>
          </div>
        </>
      )}
    </div>
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
