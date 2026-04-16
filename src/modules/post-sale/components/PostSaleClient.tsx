"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { CustomerSummary, PostSaleStatus, PostSaleFilterConfig } from "../types";
import { FilterConfigModal } from "./FilterConfigModal";
import {
  MessageCircle, Clock, Scissors,
  ChevronDown, ChevronUp, Loader2, Lightbulb, CheckCircle2, AlertTriangle,
  UserMinus, RefreshCcw, Star, Phone, Send, ExternalLink, Sparkles, X, Save,
  Search, Settings2, Filter,
} from "lucide-react";

// ── Status actions ────────────────────────────────────────────

interface ActionConfig {
  id:         string;
  label:      string;
  type:       string;
  icon:       React.ComponentType<{ className?: string }>;
  isReview?:  boolean;
  isCustom?:  boolean;
}

// All available actions
const ALL_ACTIONS: ActionConfig[] = [
  { id: "reactivation", label: "Mensagem de reativação", type: "reactivation",       icon: MessageCircle },
  { id: "promo",        label: "Oferta especial",         type: "reactivation_promo", icon: Star },
  { id: "review",       label: "Avaliação Google",        type: "post_sale_review",   icon: Star, isReview: true },
  { id: "followup",     label: "Acompanhamento",          type: "post_sale_followup", icon: MessageCircle },
  { id: "custom",       label: "Mensagem personalizada",  type: "custom",             icon: Send, isCustom: true },
];

// Suggested (shown by default) per status; others available via "Outros"
const SUGGESTED_IDS: Record<PostSaleStatus, string[]> = {
  RECENTE:      ["review", "followup"],
  EM_RISCO:     ["reactivation", "promo"],
  INATIVO:      ["reactivation", "promo"],
  REATIVADO:    ["followup", "review"],
  NAO_CONTATAR: [],
};

function getActions(status: PostSaleStatus) {
  const suggestedIds = SUGGESTED_IDS[status] ?? [];
  const suggested = suggestedIds.map((id) => ALL_ACTIONS.find((a) => a.id === id)!).filter(Boolean);
  const others = ALL_ACTIONS.filter((a) => !suggestedIds.includes(a.id));
  return { suggested, others };
}

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
  filterConfig:    PostSaleFilterConfig;
}

// ── Custom filter matching ────────────────────────────────────

function matchesCustomFilter(customer: CustomerSummary, serviceId: string, followUpDays: number): boolean {
  const now = Date.now();
  const cutoffMs = followUpDays * 86_400_000;
  const matching = (customer.recentAppointments ?? []).find((a) => a.serviceId === serviceId);
  if (!matching || !matching.completedAt) return false;
  return (now - new Date(matching.completedAt).getTime()) > cutoffMs;
}

// ── Color presets for custom filters ─────────────────────────

const CUSTOM_COLORS = [
  { cardBorder: "border-teal-500/40",   cardBg: "bg-teal-500/5",   numColor: "text-teal-400",   iconClass: "text-teal-400" },
  { cardBorder: "border-purple-500/40", cardBg: "bg-purple-500/5", numColor: "text-purple-400", iconClass: "text-purple-400" },
  { cardBorder: "border-pink-500/40",   cardBg: "bg-pink-500/5",   numColor: "text-pink-400",   iconClass: "text-pink-400" },
  { cardBorder: "border-cyan-500/40",   cardBg: "bg-cyan-500/5",   numColor: "text-cyan-400",   iconClass: "text-cyan-400" },
  { cardBorder: "border-amber-500/40",  cardBg: "bg-amber-500/5",  numColor: "text-amber-400",  iconClass: "text-amber-400" },
];

// ── Root component ────────────────────────────────────────────

const VALID_DEFAULT_FILTERS = new Set<string>(["emRisco", "recentes", "inativos", "reativados"]);

export function PostSaleClient({ summary, customers, googleReviewUrl, filterConfig: initialFilterConfig }: Props) {
  const searchParams = useSearchParams();
  const [filterConfig, setFilterConfig] = useState(initialFilterConfig);
  const [showConfigModal, setShowConfigModal] = useState(false);

  const initialFilter = useMemo(() => {
    const param = searchParams.get("filter");
    return param && filterConfig.visible.includes(param) ? param : null;
  }, [searchParams, filterConfig.visible]);
  const [active, setActive] = useState<string | null>(initialFilter);
  const [nameSearch, setNameSearch] = useState("");

  // Build visible filters from config
  const visibleFilters = useMemo(() => {
    return filterConfig.visible.map((key, idx) => {
      // Default filter
      const defaultDef = FILTER_CONFIG.find((d) => d.key === key);
      if (defaultDef) {
        return { ...defaultDef, type: "default" as const, serviceId: null, followUpDays: 0 };
      }
      // Custom filter
      const customDef = filterConfig.custom.find((c) => c.id === key);
      if (!customDef) return null;
      const colors = CUSTOM_COLORS[idx % CUSTOM_COLORS.length];
      return {
        key: customDef.id,
        label: customDef.serviceName,
        tooltip: `Clientes cujo último "${customDef.serviceName}" foi há mais de ${customDef.followUpDays} dias`,
        icon: <Filter className={`h-4 w-4 ${colors.iconClass}`} />,
        ...colors,
        type: "custom" as const,
        serviceId: customDef.serviceId,
        followUpDays: customDef.followUpDays,
      };
    }).filter(Boolean) as Array<{
      key: string; label: string; tooltip: string; icon: React.ReactNode;
      cardBorder: string; cardBg: string; numColor: string;
      type: "default" | "custom"; serviceId: string | null; followUpDays: number;
    }>;
  }, [filterConfig]);

  // Compute counts for custom filters client-side
  const customCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const vf of visibleFilters) {
      if (vf.type === "custom" && vf.serviceId) {
        counts[vf.key] = customers.filter((c) => matchesCustomFilter(c, vf.serviceId!, vf.followUpDays)).length;
      }
    }
    return counts;
  }, [customers, visibleFilters]);

  // Filter customers based on active filter
  const filteredCustomers = useMemo(() => {
    let result = customers;
    if (active) {
      const activeDef = visibleFilters.find((f) => f.key === active);
      if (activeDef) {
        if (activeDef.type === "default" && VALID_DEFAULT_FILTERS.has(active)) {
          result = customers.filter((c) => c.postSaleStatus === FILTER_STATUS[active as FilterKey]);
        } else if (activeDef.type === "custom" && activeDef.serviceId) {
          result = customers.filter((c) => matchesCustomFilter(c, activeDef.serviceId!, activeDef.followUpDays));
        }
      }
    }
    if (nameSearch) {
      result = result.filter((c) => c.name.toLowerCase().includes(nameSearch.toLowerCase()));
    }
    return result;
  }, [active, customers, nameSearch, visibleFilters]);

  const activeLabel = visibleFilters.find((f) => f.key === active)?.label;

  return (
    <div className="space-y-5">
      {/* Filter cards */}
      <div className="flex items-start gap-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 flex-1">
          {visibleFilters.map((cfg) => {
            const isActive = active === cfg.key;
            const count = cfg.type === "default"
              ? summary[cfg.key as keyof SummaryData] ?? 0
              : customCounts[cfg.key] ?? 0;
            return (
              <button
                key={cfg.key}
                onClick={() => { setActive((prev) => prev === cfg.key ? null : cfg.key); setNameSearch(""); }}
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
        <button
          onClick={() => setShowConfigModal(true)}
          className="shrink-0 mt-1 rounded-lg border border-border p-2.5 hover:bg-surface-800 transition-colors text-muted-foreground hover:text-foreground"
          title="Configurar filtros"
        >
          <Settings2 className="h-4 w-4" />
        </button>
      </div>

      {/* Name search */}
      {active && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nome..."
            value={nameSearch}
            onChange={(e) => setNameSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-900 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      {/* Subtitle */}
      <p className="text-sm text-muted-foreground">
        {active
          ? `Mostrando ${filteredCustomers.length} cliente(s) com filtro "${activeLabel}".`
          : "Mostrando todos os clientes com status pós-venda. Clique em um filtro acima para ver por categoria."}
      </p>

      {/* Customer list — expandable inline */}
      <CustomerList
        rows={filteredCustomers}
        emptyMessage={active ? `Nenhum cliente em "${activeLabel}".` : "Selecione um filtro acima para ver os clientes."}
        showAll={!active}
        googleReviewUrl={googleReviewUrl}
      />

      {/* Config modal */}
      {showConfigModal && (
        <FilterConfigModal
          config={filterConfig}
          onSaved={(cfg) => { setFilterConfig(cfg); setActive(null); }}
          onClose={() => setShowConfigModal(false)}
        />
      )}
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
  const [showOthers, setShowOthers] = useState(false);
  const { suggested, others } = getActions(customer.postSaleStatus);
  const actions               = [...suggested, ...others];
  const doneCount             = suggested.filter((a) => isActionDone(a, customer)).length;
  const allDone               = suggested.length > 0 && doneCount === suggested.length;

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
              {format(new Date(customer.lastVisitAt), "dd/MM/yyyy", { locale: ptBR })} ({relativeTime(customer.lastVisitAt)})
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
          <div className="space-y-2">
            {/* Done actions */}
            {actions.filter((a) => isActionDone(a, customer)).map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-md border border-green-500/20 bg-green-500/5 px-3 py-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
                <span className="text-xs text-green-400">{a.label}</span>
              </div>
            ))}

            {composing ? (
              <MessageComposer
                customer={customer}
                action={composing}
                googleReviewUrl={googleReviewUrl}
                onCancel={() => setComposing(null)}
                onSent={() => { onSent(composing); setComposing(null); }}
              />
            ) : (
              <>
                {/* Suggested actions */}
                <div className="space-y-1.5">
                  {suggested.filter((a) => !isActionDone(a, customer)).map((action) => {
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

                {/* "Outros" toggle */}
                {others.length > 0 && (
                  <>
                    <button
                      onClick={() => setShowOthers((v) => !v)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                    >
                      <ChevronDown className={`h-3 w-3 transition-transform ${showOthers ? "rotate-180" : ""}`} />
                      {showOthers ? "Menos opções" : "Outras opções"}
                    </button>

                    {showOthers && (
                      <div className="space-y-1.5">
                        {others.filter((a) => !isActionDone(a, customer)).map((action) => {
                          const Icon = action.icon;
                          return (
                            <button
                              key={action.id}
                              onClick={() => setComposing(action)}
                              className="w-full flex items-center gap-3 rounded-lg border border-border hover:border-purple-500/30 hover:bg-purple-500/5 px-4 py-2.5 text-sm text-left transition-colors"
                            >
                              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="flex-1 text-foreground">{action.label}</span>
                              {action.isCustom
                                ? <Send className="h-3.5 w-3.5 text-muted-foreground" />
                                : <Sparkles className="h-3.5 w-3.5 text-purple-400/40" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
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
  const [message,        setMessage]        = useState("");
  const [loading,        setLoading]        = useState(true);
  const [sending,        setSending]        = useState(false);
  const [error,          setError]          = useState("");
  const [localReviewUrl, setLocalReviewUrl] = useState(googleReviewUrl);
  const [urlInput,       setUrlInput]       = useState("");
  const [savingUrl,      setSavingUrl]      = useState(false);
  const [urlError,       setUrlError]       = useState("");
  const [localPhone,     setLocalPhone]     = useState(customer.phone ?? "");
  const [phoneInput,     setPhoneInput]     = useState("");
  const [savingPhone,    setSavingPhone]    = useState(false);
  const [phoneError,     setPhoneError]     = useState("");

  const missingReviewUrl = action.isReview && !localReviewUrl;
  const missingPhone     = !localPhone;

  const daysSinceVisit = customer.lastVisitAt
    ? Math.floor((Date.now() - new Date(customer.lastVisitAt).getTime()) / 86_400_000)
    : undefined;

  async function generate(reviewUrl: string | null) {
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
          googleReviewUrl: action.isReview ? reviewUrl : undefined,
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

  useEffect(() => {
    if (action.isCustom) { setLoading(false); return; }
    if (missingReviewUrl) { setLoading(false); return; }
    generate(localReviewUrl);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSaveUrl() {
    if (!urlInput.trim()) return;
    setSavingUrl(true);
    setUrlError("");
    try {
      const res = await fetch("/api/barbershop", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ googleReviewUrl: urlInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setUrlError(data.error ?? "Erro ao salvar. Tente novamente."); return; }
      const saved = data.barbershop.googleReviewUrl as string;
      setLocalReviewUrl(saved);
      generate(saved);
    } catch {
      setUrlError("Erro ao salvar. Tente novamente.");
    } finally {
      setSavingUrl(false);
    }
  }

  async function handleSavePhone() {
    const digits = phoneInput.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 13) {
      setPhoneError("Informe um telefone válido (DDD + número).");
      return;
    }
    setSavingPhone(true);
    setPhoneError("");
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ phone: digits }),
      });
      const data = await res.json();
      if (!res.ok) { setPhoneError(data.error ?? "Erro ao salvar telefone."); return; }
      setLocalPhone(data.customer.phone);
    } catch {
      setPhoneError("Erro ao salvar telefone. Tente novamente.");
    } finally {
      setSavingPhone(false);
    }
  }

  async function handleSend() {
    if (!localPhone || !message.trim()) return;
    setSending(true);
    setError("");
    const digits  = localPhone.replace(/\D/g, "");
    const waPhone = digits.startsWith("55") ? digits : `55${digits}`;
    // Abre antes do await para não ser bloqueado pelo browser como popup
    window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(message.trim())}`, "_blank");
    try {
      await fetch("/api/whatsapp/messages", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          customerId:   customer.id,
          customerName: customer.name,
          phone:        localPhone,
          message:      message.trim(),
          type:         action.type,
          messageKind:  "text",
          sentManually: true,
        }),
      });
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
          {action.isCustom
            ? <Send className="h-3.5 w-3.5 text-gold-400" />
            : <Sparkles className="h-3.5 w-3.5 text-purple-400" />}
          <span className="text-xs font-medium text-foreground">{action.label}</span>
        </div>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Missing review URL — inline setup */}
      {missingReviewUrl ? (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300 leading-relaxed">
              Cole o link do Google Business abaixo para enviar pedidos de avaliação.
            </p>
          </div>
          <div className="space-y-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://g.page/r/..."
              className="w-full rounded-md border border-blue-500/30 bg-surface-800 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              onKeyDown={(e) => { if (e.key === "Enter") handleSaveUrl(); }}
            />
            {urlError && <p className="text-xs text-red-400">{urlError}</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={onCancel} disabled={savingUrl}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="flex-1 text-xs gap-1.5 bg-gold-500 hover:bg-gold-400 text-black"
              onClick={handleSaveUrl}
              disabled={!urlInput.trim() || savingUrl}
            >
              {savingUrl ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              {savingUrl ? "Salvando..." : "Salvar e continuar"}
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
              <span className="text-[10px] text-muted-foreground">
                {action.isCustom ? "Escreva sua mensagem" : "Mensagem gerada pela IA — edite se quiser"}
              </span>
              {!action.isCustom && (
                <span className="text-[10px] text-purple-400/70 flex items-center gap-1">
                  <Sparkles className="h-2.5 w-2.5" /> IA
                </span>
              )}
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="w-full rounded-lg border border-purple-500/20 bg-card px-3 py-2.5 text-sm text-foreground leading-relaxed focus:outline-none focus:ring-2 focus:ring-purple-500/40 resize-none"
            />
          </div>

          {missingPhone && (
            <div className="space-y-2">
              <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
                <Phone className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300 leading-relaxed">
                  Cliente sem telefone cadastrado. Informe o número para enviar a mensagem.
                </p>
              </div>
              <input
                type="tel"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="(11) 98765-4321"
                className="w-full rounded-md border border-amber-500/30 bg-surface-800 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                onKeyDown={(e) => { if (e.key === "Enter") handleSavePhone(); }}
              />
              {phoneError && <p className="text-xs text-red-400">{phoneError}</p>}
              <Button
                size="sm"
                className="w-full text-xs gap-1.5 bg-gold-500 hover:bg-gold-400 text-black"
                onClick={handleSavePhone}
                disabled={!phoneInput.trim() || savingPhone}
              >
                {savingPhone ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                {savingPhone ? "Salvando..." : "Salvar telefone"}
              </Button>
            </div>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={onCancel} disabled={sending}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="flex-1 text-xs gap-1.5 bg-purple-600 hover:bg-purple-500 text-white"
              disabled={missingPhone || !message.trim() || sending}
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
