"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/utils";
import type { CustomerSummary, PostSaleStatus } from "../types";
import {
  X,
  MessageCircle,
  Calendar,
  Phone,
  Clock,
  Scissors,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { useEffect } from "react";

// ── Status config ─────────────────────────────────────────────────────────────

interface ActionConfig {
  id:        string;
  label:     string;
  type:      string;  // maps to generate-message types
  icon:      React.ComponentType<{ className?: string }>;
  scheduled?: boolean;  // true = shows date picker and queues instead of sending immediately
}

const STATUS_ACTIONS: Record<PostSaleStatus, ActionConfig[]> = {
  RECENTE: [
    { id: "review",   label: "Pedir avaliação Google", type: "post_sale_review",   icon: MessageCircle },
    { id: "followup", label: "Agendar mensagem",        type: "post_sale_followup", icon: Calendar, scheduled: true },
  ],
  EM_RISCO: [
    { id: "reactivation", label: "Mensagem de reativação", type: "reactivation",       icon: MessageCircle },
    { id: "promo",        label: "Oferta especial",         type: "reactivation_promo", icon: MessageCircle },
    { id: "schedule",     label: "Agendar mensagem",        type: "reactivation",       icon: Calendar, scheduled: true },
  ],
  INATIVO: [
    { id: "reactivation", label: "Mensagem de reativação", type: "reactivation",       icon: MessageCircle },
    { id: "promo",        label: "Oferta especial",         type: "reactivation_promo", icon: MessageCircle },
    { id: "schedule",     label: "Agendar mensagem",        type: "reactivation",       icon: Calendar, scheduled: true },
  ],
  REATIVADO: [
    { id: "followup", label: "Mensagem de acompanhamento", type: "post_sale_followup", icon: MessageCircle },
    { id: "review",   label: "Pedir avaliação Google",     type: "post_sale_review",   icon: MessageCircle },
    { id: "schedule", label: "Agendar mensagem",            type: "post_sale_followup", icon: Calendar, scheduled: true },
  ],
  NAO_CONTATAR: [],
};

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterKey = "emRisco" | "avalPendentes" | "recentes" | "inativos" | "reativados";

const FILTER_LABELS: Record<FilterKey, string> = {
  emRisco:       "Clientes em risco",
  avalPendentes: "Avaliações pendentes",
  recentes:      "Recém-atendidos",
  inativos:      "Inativos",
  reativados:    "Reativados",
};

const FILTER_STATUS: Record<FilterKey, string | null> = {
  emRisco:       "EM_RISCO",
  avalPendentes: null,
  recentes:      "RECENTE",
  inativos:      "INATIVO",
  reativados:    "REATIVADO",
};

interface SummaryData {
  emRisco:       number;
  avalPendentes: number;
  recentes:      number;
  inativos:      number;
  reativados:    number;
}

export interface ReviewItem {
  id:            string;
  customerId:    string;
  appointmentId: string;
  customerName:  string;
  customerPhone?: string | null;
  completedAt?:  string | null;
  serviceName?:  string | null;
  requestStatus: string;
}

interface Props {
  summary:   SummaryData;
  customers: CustomerSummary[];
  reviews:   ReviewItem[];
}

// ── Root component ────────────────────────────────────────────────────────────

export function PostSaleClient({ summary, customers, reviews }: Props) {
  const [active, setActive] = useState<FilterKey | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSummary | null>(null);

  function toggle(key: FilterKey) {
    setActive((prev) => (prev === key ? null : key));
  }

  let filteredCustomers: CustomerSummary[] = customers;
  let showReviews = false;

  if (active === "avalPendentes") {
    showReviews       = true;
    filteredCustomers = [];
  } else if (active && FILTER_STATUS[active]) {
    const status      = FILTER_STATUS[active];
    filteredCustomers = customers.filter((c) => c.postSaleStatus === status);
  }

  return (
    <div className="space-y-5">
      {/* Summary / filter cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {(Object.keys(FILTER_LABELS) as FilterKey[]).map((key) => {
          const isActive = active === key;
          const count    = summary[key];
          return (
            <button
              key={key}
              onClick={() => toggle(key)}
              className={`rounded-lg border text-left p-4 transition-all focus:outline-none focus:ring-2 focus:ring-ring
                ${isActive
                  ? "border-gold-500/60 bg-gold-500/10 shadow-[0_0_0_1px_rgba(234,179,8,0.25)]"
                  : "border-border/60 bg-surface-900 hover:border-border"}`}
            >
              <p className={`text-xs mb-1.5 ${isActive ? "text-gold-400" : "text-muted-foreground"}`}>
                {FILTER_LABELS[key]}
              </p>
              <p className={`text-2xl font-semibold tabular-nums ${isActive ? "text-gold-400" : "text-foreground"}`}>
                {count}
              </p>
              {isActive && (
                <p className="text-[10px] text-gold-400/70 mt-1">filtro ativo · clique para limpar</p>
              )}
            </button>
          );
        })}
      </div>

      {/* Results */}
      {showReviews ? (
        <ReviewList reviews={reviews} />
      ) : (
        <CustomerList
          rows={filteredCustomers}
          emptyMessage={
            active
              ? `Nenhum cliente em "${FILTER_LABELS[active]}".`
              : "Selecione um filtro acima para ver os clientes."
          }
          showAll={!active}
          onSelect={setSelectedCustomer}
        />
      )}

      {/* Detail drawer */}
      {selectedCustomer && (
        <CustomerDetailSheet
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </div>
  );
}

// ── Customer list (compact mobile cards) ─────────────────────────────────────

function CustomerList({
  rows,
  emptyMessage,
  showAll,
  onSelect,
}: {
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
          Mostrando todos os clientes com status pós-venda. Clique em uma caixa acima para filtrar.
        </p>
      )}
      {display.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c)}
          className="w-full rounded-lg border border-border/60 bg-surface-900 hover:border-border hover:bg-surface-800 transition-colors text-left"
        >
          <div className="px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              {/* Status badge on top */}
              <div className="flex items-center gap-2 mb-1">
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 leading-5 ${statusBadgeClass(c.postSaleStatus)}`}
                >
                  {statusLabel(c.postSaleStatus)}
                </Badge>
              </div>
              {/* Name */}
              <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
              {/* Last visit */}
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
      ))}
    </div>
  );
}

// ── Customer detail sheet (slide-up) ─────────────────────────────────────────

function CustomerDetailSheet({
  customer,
  onClose,
}: {
  customer: CustomerSummary;
  onClose: () => void;
}) {
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [selectedAction, setSelectedAction] = useState<ActionConfig | null>(null);

  const actions = STATUS_ACTIONS[customer.postSaleStatus] ?? [];

  // WhatsApp button disabled logic
  const isWhatsAppDisabled = Boolean(
    customer.lastWhatsappSentAt &&
    customer.lastCompletedAppointmentAt &&
    new Date(customer.lastWhatsappSentAt) > new Date(customer.lastCompletedAppointmentAt)
  );

  function handleActionClick(action: ActionConfig) {
    if (action.id === "schedule" || action.id === "followup") {
      setSelectedAction(action);
      setShowWhatsApp(false);
    } else {
      setSelectedAction(action);
      setShowWhatsApp(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-border bg-card shadow-xl max-h-[85vh] overflow-y-auto">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge
                variant="outline"
                className={`text-[10px] ${statusBadgeClass(customer.postSaleStatus)}`}
              >
                {statusLabel(customer.postSaleStatus)}
              </Badge>
            </div>
            <h2 className="text-base font-semibold text-foreground">{customer.name}</h2>
            {customer.phone && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Phone className="h-3 w-3" />
                {customer.phone}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pb-6 space-y-4">
          {/* Last visit info */}
          <div className="rounded-lg border border-border/60 bg-surface-900 p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Último atendimento</p>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-500/10 border border-gold-500/20">
                <Scissors className="h-4 w-4 text-gold-400" />
              </div>
              <div>
                {customer.serviceName ? (
                  <p className="text-sm font-medium text-foreground">{customer.serviceName}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Serviço não registrado</p>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {customer.lastVisitAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {relativeTime(customer.lastVisitAt)}
                    </span>
                  )}
                  {customer.servicePrice != null && (
                    <span>· R$ {customer.servicePrice.toFixed(2).replace(".", ",")}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Stats row */}
            {(customer.ticketMedio != null || customer.frequencia != null) && (
              <div className="flex gap-4 pt-1 border-t border-border/40">
                {customer.ticketMedio != null && (
                  <div>
                    <p className="text-[10px] text-muted-foreground">Ticket médio</p>
                    <p className="text-xs font-medium text-foreground">
                      R$ {customer.ticketMedio.toFixed(2).replace(".", ",")}
                    </p>
                  </div>
                )}
                {customer.frequencia != null && (
                  <div>
                    <p className="text-[10px] text-muted-foreground">Visitas totais</p>
                    <p className="text-xs font-medium text-foreground">{customer.frequencia}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* WhatsApp button (disabled if already sent since last appointment) */}
          {actions.length > 0 && (
            <div>
              <Button
                className="w-full gap-2"
                variant={isWhatsAppDisabled ? "outline" : "default"}
                disabled={isWhatsAppDisabled}
                onClick={() => setShowWhatsApp(true)}
              >
                <MessageCircle className="h-4 w-4" />
                {isWhatsAppDisabled ? "Mensagem enviada · aguardando próximo atendimento" : "Enviar mensagem"}
              </Button>
              {isWhatsAppDisabled && customer.lastWhatsappSentAt && (
                <p className="text-[10px] text-muted-foreground text-center mt-1">
                  Último envio: {relativeTime(customer.lastWhatsappSentAt)}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* WhatsApp action sheet */}
      {showWhatsApp && (
        <WhatsAppActionSheet
          customer={customer}
          actions={actions}
          onClose={() => setShowWhatsApp(false)}
          onAction={handleActionClick}
        />
      )}

      {/* Template message modal */}
      {selectedAction && (
        <TemplateMessageModal
          customer={customer}
          action={selectedAction}
          onClose={() => setSelectedAction(null)}
          onSent={() => {
            setSelectedAction(null);
            setShowWhatsApp(false);
            onClose();
          }}
        />
      )}
    </>
  );
}

// ── WhatsApp action sheet ─────────────────────────────────────────────────────

function WhatsAppActionSheet({
  customer,
  actions,
  onClose,
  onAction,
}: {
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
              const isSchedule = action.id === "schedule" || action.id === "followup";
              return (
                <button
                  key={action.id}
                  onClick={() => onAction(action)}
                  className="w-full flex items-center gap-3 rounded-lg border border-border/60 bg-surface-900 hover:border-border hover:bg-surface-800 px-4 py-3 text-sm text-left transition-colors"
                >
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 text-foreground">{action.label}</span>
                  {isSchedule && (
                    <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-400/30">
                      Agendada
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
          <Button variant="ghost" className="w-full mt-3 text-muted-foreground" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </div>
    </>
  );
}

// ── Template variable type ────────────────────────────────────────────────────

interface WaTemplate {
  id:        string;
  metaName:  string;
  label:     string;
  body:      string;
  variables: string; // JSON: [{key,label,defaultValue}]
}

interface TemplateVar { key: string; label: string; defaultValue: string }

// ── Template message modal (used for ALL post-sale sends) ─────────────────────

function TemplateMessageModal({
  customer,
  action,
  onClose,
  onSent,
}: {
  customer: CustomerSummary;
  action:   ActionConfig;
  onClose:  () => void;
  onSent:   () => void;
}) {
  const isScheduled = !!action.scheduled;
  const todayStr    = new Date().toISOString().slice(0, 10);

  const [templates,    setTemplates]    = useState<WaTemplate[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [selectedTpl,  setSelectedTpl]  = useState<WaTemplate | null>(null);
  const [varValues,    setVarValues]    = useState<string[]>([]);
  const [scheduledFor, setScheduledFor] = useState(isScheduled ? todayStr : "");
  const [sending,      setSending]      = useState(false);
  const [error,        setError]        = useState("");

  // Load templates on mount
  useEffect(() => {
    fetch("/api/whatsapp/templates")
      .then((r) => r.json())
      .then((data: WaTemplate[]) => {
        setTemplates(data);
        if (data.length === 1) selectTemplate(data[0]);
      })
      .catch(() => setError("Erro ao carregar templates."))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectTemplate(tpl: WaTemplate) {
    setSelectedTpl(tpl);
    const vars: TemplateVar[] = JSON.parse(tpl.variables || "[]");
    setVarValues(vars.map((v) => {
      if (v.key === "customer_name" || v.key === "nome") return customer.name;
      return v.defaultValue ?? "";
    }));
    setError("");
  }

  function previewBody() {
    if (!selectedTpl) return "";
    return selectedTpl.body.replace(/\{\{(\d+)\}\}/g, (_, i) => varValues[Number(i) - 1] ?? `{{${i}}}`);
  }

  async function handleSend() {
    if (!selectedTpl || !customer.phone) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/whatsapp/messages", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          customerId:   customer.id,
          customerName: customer.name,
          phone:        customer.phone,
          message:      previewBody(),
          type:         action.type,
          messageKind:  "template",
          templateName: selectedTpl.metaName,
          templateVars: varValues,
          scheduledFor: isScheduled && scheduledFor ? scheduledFor : undefined,
        }),
      });
      if (!res.ok) throw new Error("Falha ao agendar");
      onSent();
    } catch {
      setError("Erro ao agendar mensagem.");
    } finally {
      setSending(false);
    }
  }

  const vars: TemplateVar[] = selectedTpl ? JSON.parse(selectedTpl.variables || "[]") : [];

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-60" onClick={onClose} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[70] rounded-xl border border-border bg-card shadow-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{action.label}</h3>
            <p className="text-xs text-muted-foreground">{customer.name}</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Date picker */}
        {isScheduled && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Data de envio</label>
            <input
              type="date"
              value={scheduledFor}
              min={todayStr}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-900 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )}

        {/* Template selector */}
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando templates...
          </div>
        ) : templates.length === 0 ? (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-3 text-xs text-amber-300 space-y-1">
            <p className="font-medium">Nenhum template configurado</p>
            <p>Acesse o painel admin → WhatsApp Templates para cadastrar os templates aprovados pela Meta.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Template</label>
            <select
              value={selectedTpl?.id ?? ""}
              onChange={(e) => {
                const t = templates.find((t) => t.id === e.target.value);
                if (t) selectTemplate(t);
              }}
              className="w-full rounded-md border border-border bg-surface-900 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Selecione um template…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Variable inputs */}
        {vars.length > 0 && vars.map((v, i) => (
          <div key={v.key} className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{v.label}</label>
            <input
              type="text"
              value={varValues[i] ?? ""}
              onChange={(e) => {
                const next = [...varValues];
                next[i] = e.target.value;
                setVarValues(next);
              }}
              className="w-full rounded-md border border-border bg-surface-900 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        ))}

        {/* Preview */}
        {selectedTpl && (
          <div className="rounded-lg border border-border/40 bg-surface-800/50 px-3 py-2 space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Pré-visualização</p>
            <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{previewBody()}</p>
          </div>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button
            className="flex-1 gap-2"
            disabled={!selectedTpl || !customer.phone || sending || (isScheduled && !scheduledFor) || templates.length === 0}
            onClick={handleSend}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
            {isScheduled ? "Agendar envio" : "Enviar agora"}
          </Button>
        </div>
      </div>
    </>
  );
}

// ── Review list ───────────────────────────────────────────────────────────────

function ReviewList({ reviews }: { reviews: ReviewItem[] }) {
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentIds,   setSentIds]   = useState<Set<string>>(new Set());

  async function sendReview(r: ReviewItem) {
    if (!r.customerPhone) return;
    setSendingId(r.id);
    setReviewTemplate(r.id);
  }

  function setReviewTemplate(reviewId: string) {
    setSendingId(null);
    setOpenReviewId(reviewId);
  }

  const [openReviewId, setOpenReviewId] = useState<string | null>(null);

  if (reviews.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
        Nenhuma avaliação pendente nas últimas 48h.
      </div>
    );
  }

  const openReview = openReviewId ? reviews.find((r) => r.id === openReviewId) : null;

  return (
    <>
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Clientes atendidos nas últimas 48h aguardando solicitação de avaliação Google.
        </p>
        {reviews.map((r) => (
          <div key={r.id} className="rounded-lg border border-border/60 bg-surface-900">
            <div className="py-3 px-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{r.customerName}</p>
                <div className="text-xs text-muted-foreground flex flex-wrap gap-2 mt-0.5">
                  {r.customerPhone && <span>{r.customerPhone}</span>}
                  {r.completedAt && <span>Atendido {relativeTime(r.completedAt)}</span>}
                  {r.serviceName && <span>{r.serviceName}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {sentIds.has(r.id) ? (
                  <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-400/30">
                    Agendado
                  </Badge>
                ) : (
                  <>
                    <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-400/30">
                      Pendente
                    </Badge>
                    <Button
                      size="sm"
                      className="h-7 text-xs gap-1"
                      disabled={!r.customerPhone}
                      onClick={() => sendReview(r)}
                    >
                      <MessageCircle className="h-3 w-3" />
                      Pedir avaliação
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {openReview && (
        <TemplateMessageModal
          customer={{
            id: openReview.customerId,
            name: openReview.customerName,
            phone: openReview.customerPhone ?? null,
            postSaleStatus: "RECENTE",
            lastVisitAt: openReview.completedAt ?? null,
            serviceName: openReview.serviceName ?? null,
            servicePrice: null,
            lastWhatsappSentAt: null,
            lastCompletedAppointmentAt: null,
          }}
          action={{ id: "review", label: "Pedir avaliação Google", type: "post_sale_review", icon: MessageCircle }}
          onClose={() => setOpenReviewId(null)}
          onSent={() => {
            setSentIds((prev) => new Set([...prev, openReview.id]));
            setOpenReviewId(null);
          }}
        />
      )}
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusLabel(s: string) {
  const map: Record<string, string> = {
    RECENTE:      "Recente",
    EM_RISCO:     "Em risco",
    INATIVO:      "Inativo",
    REATIVADO:    "Reativado",
    NAO_CONTATAR: "Não contatar",
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
