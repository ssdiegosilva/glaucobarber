"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Send, CheckCircle2, Sparkles,
  Trash2, ChevronDown, ChevronUp, Plus,
  MessageCircle, Megaphone, Target, Calendar, Users,
  DollarSign, Trophy, Zap, ExternalLink, X,
} from "lucide-react";
import { isAiLimitError, triggerAiLimitModal } from "@/lib/ai-error";

type Thread = {
  id: string;
  title: string | null;
  status: string;
  lastMessageAt: string;
};

type Message = {
  id: string;
  threadId: string;
  role: "USER" | "ASSISTANT" | "ACTION";
  content: string;
  actionsJson?: any;
  createdAt: string;
};

type ActionItem = {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  status: string;
  payload?: Record<string, unknown> | null;
  createdAt: string;
};

type ActionStatus = "pending" | "approved" | "dismissed";

const WHATSAPP_ACTION_TYPES = new Set([
  "reactivation_promo", "agenda_conflict",
]);

// Types that just navigate somewhere — no "Aprovar" needed
const LINK_ONLY_ACTIONS: Record<string, { label: string; href: string }> = {
  define_goal:        { label: "Ir para Metas",    href: "/meta" },
  campaign:           { label: "Ver Campanhas",     href: "/campaigns" },
  agenda:             { label: "Ver Agenda",         href: "/agenda" },
  block_agenda:       { label: "Abrir Agenda",      href: "/agenda" },
  crm:                { label: "Ver Clientes",       href: "/clients" },
  pricing:            { label: "Ver Serviços",       href: "/services" },
  post_sale_followup: { label: "Ver Pós-venda",     href: "/post-sale" },
  post_sale_review:   { label: "Ver Pós-venda",     href: "/post-sale" },
};

function deriveStatuses(actions: ActionItem[]): Record<string, ActionStatus> {
  const out: Record<string, ActionStatus> = {};
  for (const a of actions) {
    if (a.status === "APPROVED") out[a.id] = "approved";
  }
  return out;
}

interface Props {
  initialThreads:  Thread[];
  initialMessages: Message[];
  initialActions:  ActionItem[];
  initialThreadId: string | null;
}

const QUICK_QUESTIONS = [
  "Como está meu dia hoje?",
  "Estou perto da meta do mês?",
  "Quais clientes devo reativar?",
  "Tenho sobreposições na agenda?",
  "Que campanha devo fazer agora?",
  "Como melhorar minha ocupação?",
  "Como escrever uma bio pro Instagram?",
  "Me explica o que é ticket médio",
];

// ── Helpers ───────────────────────────────────────────────────

function getActionIcon(type: string) {
  switch (type) {
    case "reactivation_promo":
    case "post_sale_followup":
    case "post_sale_review":
    case "agenda_conflict":
      return MessageCircle;
    case "campaign":
      return Megaphone;
    case "define_goal":
      return Target;
    case "agenda":
    case "block_agenda":
      return Calendar;
    case "crm":
      return Users;
    case "pricing":
      return DollarSign;
    case "motivational":
      return Trophy;
    default:
      return Zap;
  }
}

function getActionLinks(
  type: string,
  payload?: Record<string, unknown> | null
): { label: string; href: string }[] {
  if (type === "reactivation_promo" || type === "agenda_conflict") {
    const phones      = payload?.phones      as string[] | undefined;
    const clientNames = payload?.clientNames as string[] | undefined;
    const singlePhone = payload?.phone       as string   | undefined;
    const message     = (payload?.message ?? payload?.suggestedMessage) as string | undefined;

    if (phones?.length) {
      return phones.map((phone, i) => {
        const clean   = phone.replace(/\D/g, "");
        const waPhone = clean.startsWith("55") ? clean : `55${clean}`;
        const url     = message
          ? `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`
          : `https://wa.me/${waPhone}`;
        const name = clientNames?.[i];
        return { label: name ? `WhatsApp · ${name}` : "Abrir WhatsApp", href: url };
      });
    }
    if (singlePhone) {
      const clean   = singlePhone.replace(/\D/g, "");
      const waPhone = clean.startsWith("55") ? clean : `55${clean}`;
      const url     = message
        ? `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`
        : `https://wa.me/${waPhone}`;
      return [{ label: "Abrir WhatsApp", href: url }];
    }
    return [];
  }
  // Link-only types never reach "approved" state via button, so no post-approve links needed
  const linkOnly = LINK_ONLY_ACTIONS[type];
  if (linkOnly) return [{ label: linkOnly.label, href: linkOnly.href }];
  return [];
}

function getPayloadPreview(
  type: string,
  payload?: Record<string, unknown> | null
): string | null {
  if (!payload) return null;
  if (type === "reactivation_promo") {
    const names    = payload.clientNames    as string[] | undefined;
    const discount = payload.suggestedDiscount as number | undefined;
    const parts: string[] = [];
    if (names?.length) {
      parts.push(
        names.slice(0, 3).join(", ") + (names.length > 3 ? ` +${names.length - 3}` : "")
      );
    }
    if (discount) parts.push(`${discount}% de desconto`);
    return parts.length ? parts.join(" · ") : null;
  }
  if (type === "agenda_conflict") {
    const clientName  = payload.clientName  as string | undefined;
    const suggestedDay  = payload.suggestedDay  as string | undefined;
    const suggestedHour = payload.suggestedHour as string | undefined;
    if (clientName) {
      return `${clientName}${suggestedDay ? ` → ${suggestedDay}${suggestedHour ? ` às ${suggestedHour}` : ""}` : ""}`;
    }
  }
  if (type === "block_agenda") {
    const startDate = payload.startDate as string | undefined;
    const endDate   = payload.endDate   as string | undefined;
    const reason    = payload.reason    as string | undefined;
    if (startDate && endDate) {
      return `${startDate} → ${endDate}${reason ? ` · ${reason}` : ""}`;
    }
  }
  return null;
}

// ── Action card ───────────────────────────────────────────────

function ActionCard({
  action,
  localStatus,
  onApprove,
  onDismiss,
}: {
  action: ActionItem;
  localStatus: ActionStatus;
  onApprove: () => void;
  onDismiss: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon      = getActionIcon(action.type);
  const links     = getActionLinks(action.type, action.payload);
  const preview   = getPayloadPreview(action.type, action.payload);
  const isLong    = (action.description?.length ?? 0) > 100;

  if (localStatus === "dismissed") {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 py-1">
        <X className="h-3 w-3 shrink-0" />
        <span className="line-through">{action.title}</span>
        <span className="no-underline">— excluída</span>
      </div>
    );
  }

  if (localStatus === "approved") {
    const isWhatsApp = WHATSAPP_ACTION_TYPES.has(action.type);
    return (
      <div className="rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[11px] text-green-400 font-medium">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          {action.title} — aprovada
        </div>
        {isWhatsApp ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Mensagens enviadas para a fila do WhatsApp.</span>
            <Link
              href="/whatsapp"
              className="inline-flex items-center gap-1 text-[11px] text-gold-400 hover:text-gold-300 underline underline-offset-2 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Ir para WhatsApp para enviar
            </Link>
          </div>
        ) : links.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                target={link.href.startsWith("http") ? "_blank" : undefined}
                rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
                className="inline-flex items-center gap-1 text-[11px] text-gold-400 hover:text-gold-300 underline underline-offset-2 transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                {link.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  // pending
  return (
    <div className="rounded-xl border border-border bg-surface-900/80 p-3 space-y-2">
      <div className="flex items-start gap-2">
        <div className="shrink-0 mt-0.5 rounded-md bg-gold-500/10 p-1.5">
          <Icon className="h-3.5 w-3.5 text-gold-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground leading-snug">{action.title}</p>
          {preview && (
            <p className="text-[10px] text-gold-400/80 mt-0.5">{preview}</p>
          )}
        </div>
      </div>

      {action.description && (
        <div>
          <p className={`text-[11px] text-muted-foreground leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>
            {action.description}
          </p>
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-0.5 text-[10px] text-gold-400 hover:text-gold-300 mt-0.5"
            >
              {expanded
                ? <><ChevronUp className="h-3 w-3" />Ver menos</>
                : <><ChevronDown className="h-3 w-3" />Ver mais</>}
            </button>
          )}
        </div>
      )}

      {LINK_ONLY_ACTIONS[action.type] ? (
        <div className="flex items-center gap-2 pt-0.5">
          <Link
            href={LINK_ONLY_ACTIONS[action.type].href}
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-md bg-gold-500 hover:bg-gold-400 text-black text-xs font-medium transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" /> {LINK_ONLY_ACTIONS[action.type].label}
          </Link>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1 text-muted-foreground hover:text-red-400 hover:border-red-400/40"
            onClick={onDismiss}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : action.type === "motivational" ? (
        <Button
          size="sm"
          variant="outline"
          className="h-8 w-full text-xs gap-1"
          onClick={onDismiss}
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> Ok, entendi
        </Button>
      ) : (
        <div className="grid grid-cols-2 gap-2 pt-0.5">
          <Button
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={onApprove}
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1 text-muted-foreground hover:text-red-400 hover:border-red-400/40"
            onClick={onDismiss}
          >
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

export default function CopilotClient({
  initialThreads,
  initialMessages,
  initialActions,
  initialThreadId,
}: Props) {
  const [threads, setThreads]               = useState<Thread[]>(initialThreads);
  const [messages, setMessages]             = useState<Message[]>(initialMessages);
  const [actions, setActions]               = useState<ActionItem[]>(initialActions);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(initialThreadId);
  const [input, setInput]                   = useState("");
  const [loading, setLoading]               = useState(false);
  const [actionStatuses, setActionStatuses] = useState<Record<string, ActionStatus>>(() => deriveStatuses(initialActions));

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, actions]);

  async function sendMessage(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setLoading(true);
    setInput("");
    try {
      const res  = await fetch("/api/copilot/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ message: msg, threadId: activeThreadId }),
      });
      const data = await res.json();
      if (isAiLimitError(res.status, data)) { triggerAiLimitModal(); return; }
      if (!res.ok) throw new Error(data.error || "Erro ao enviar");
      window.dispatchEvent(new Event("ai-used"));

      setActiveThreadId(data.threadId);
      setMessages(data.messages);
      setActions(data.actionsDraft);
      setActionStatuses(deriveStatuses(data.actionsDraft));

      setThreads((prev) => {
        const exists = prev.find((t) => t.id === data.threadId);
        if (exists) {
          return prev.map((t) =>
            t.id === data.threadId ? { ...t, lastMessageAt: new Date().toISOString() } : t
          );
        }
        return [
          { id: data.threadId, title: msg.slice(0, 40), status: "OPEN", lastMessageAt: new Date().toISOString() },
          ...prev.slice(0, 4),
        ];
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function deleteThread(id: string) {
    const res = await fetch(`/api/copilot/thread?threadId=${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setThreads((prev) => prev.filter((t) => t.id !== id));
    if (activeThreadId === id) {
      setActiveThreadId(null);
      setMessages([]);
      setActions([]);
      setActionStatuses({});
    }
  }

  async function loadThread(id: string) {
    if (id === activeThreadId) return;
    setActiveThreadId(id);
    const res  = await fetch(`/api/copilot/thread?threadId=${id}`);
    const data = await res.json();
    if (res.ok) {
      setMessages(data.messages);
      setActions(data.actions);
      setActionStatuses(deriveStatuses(data.actions));
    }
  }

  async function updateAction(id: string, path: "approve" | "dismiss") {
    const res = await fetch(`/api/actions/${id}/${path}`, { method: "POST" });
    if (!res.ok) return;
    setActionStatuses((prev) => ({
      ...prev,
      [id]: path === "approve" ? "approved" : "dismissed",
    }));
  }

  const activeMessages = useMemo(
    () => messages.filter((m) => !activeThreadId || m.threadId === activeThreadId),
    [messages, activeThreadId]
  );

  // Index of the last ASSISTANT message — actions go there
  const lastAssistantIdx = useMemo(() => {
    for (let i = activeMessages.length - 1; i >= 0; i--) {
      if (activeMessages[i].role === "ASSISTANT") return i;
    }
    return -1;
  }, [activeMessages]);

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Sidebar (threads, desktop only) ─────────────────── */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-border bg-surface-900/50">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="text-xs font-semibold text-muted-foreground">Conversas</p>
          <button
            onClick={() => { setActiveThreadId(null); setMessages([]); setActions([]); setActionStatuses({}); }}
            className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-surface-700 transition-colors"
            title="Nova conversa"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {threads.length === 0 && (
            <p className="text-xs text-muted-foreground px-1">Sem conversas ainda</p>
          )}
          {threads.map((t) => (
            <div
              key={t.id}
              className={`group relative rounded-lg border text-xs transition-colors ${
                t.id === activeThreadId
                  ? "border-gold-500/40 bg-gold-500/10"
                  : "border-border hover:border-gold-500/20"
              }`}
            >
              <button onClick={() => loadThread(t.id)} className="w-full text-left px-3 py-2 pr-7">
                <p className="font-medium text-foreground truncate">{t.title || "Sem título"}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(t.lastMessageAt).toLocaleDateString("pt-BR")}
                </p>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); deleteThread(t.id); }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-red-400 transition-opacity"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Chat column ──────────────────────────────────────── */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {activeMessages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-12">
              <div className="rounded-full bg-gold-500/10 border border-gold-500/20 p-4">
                <Sparkles className="h-7 w-7 text-gold-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Copilot da Barbearia</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Toque em uma sugestão ou escreva sua pergunta
                </p>
              </div>
            </div>
          )}

          {activeMessages.map((m, idx) => {
            const isLastAssistant = idx === lastAssistantIdx;
            const hasActions      = isLastAssistant && actions.length > 0;

            return (
              <div key={m.id} className={`flex ${m.role === "USER" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.role === "USER"
                      ? "bg-gold-500/15 border border-gold-500/25 rounded-br-sm"
                      : "bg-surface-800 border border-border rounded-bl-sm"
                  }`}
                >
                  <p className="text-[10px] font-semibold text-muted-foreground mb-1">
                    {m.role === "USER" ? "Você" : "Copilot"}
                  </p>
                  <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap">
                    {m.content}
                  </p>

                  {/* ── Inline action cards ──────────────────── */}
                  {hasActions && (
                    <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
                      <p className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1.5 mb-1">
                        <Sparkles className="h-3 w-3 text-gold-400" />
                        Ações sugeridas
                        {actions.filter((a) => (actionStatuses[a.id] ?? "pending") === "pending").length > 0 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-0.5">
                            {actions.filter((a) => (actionStatuses[a.id] ?? "pending") === "pending").length}
                          </Badge>
                        )}
                      </p>
                      {actions.map((action) => (
                        <ActionCard
                          key={action.id}
                          action={action}
                          localStatus={actionStatuses[action.id] ?? "pending"}
                          onApprove={() => updateAction(action.id, "approve")}
                          onDismiss={() => updateAction(action.id, "dismiss")}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Loading bubble */}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-surface-800 border border-border rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-gold-400 animate-bounce [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-gold-400 animate-bounce [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-gold-400 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion chips */}
        <div className="px-4 pb-2">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none snap-x">
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                disabled={loading}
                className="shrink-0 snap-start rounded-full border border-gold-500/30 bg-gold-500/8 px-3 py-1.5 text-xs text-gold-400 hover:bg-gold-500/20 transition-colors disabled:opacity-40 whitespace-nowrap"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Input bar */}
        <div className="px-4 pb-4 pt-1">
          <div className="flex items-end gap-2 rounded-xl border border-border bg-surface-900 px-3 py-2 focus-within:border-gold-500/40 focus-within:ring-1 focus-within:ring-gold-500/20 transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
              }}
              placeholder="Pergunte qualquer coisa..."
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none max-h-[120px] leading-relaxed py-0.5"
              disabled={loading}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="shrink-0 rounded-lg bg-gold-500 p-2 text-black transition-all hover:bg-gold-400 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-1.5">
            Enter envia · Shift+Enter nova linha
          </p>
        </div>
      </div>
    </div>
  );
}
