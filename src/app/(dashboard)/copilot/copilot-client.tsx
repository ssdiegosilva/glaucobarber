"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Send, CheckCircle2, MessageSquare, Sparkles,
  Trash2, ChevronDown, ChevronUp, Plus,
} from "lucide-react";

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
  createdAt: string;
};

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
];

export default function CopilotClient({ initialThreads, initialMessages, initialActions, initialThreadId }: Props) {
  const [threads, setThreads]               = useState<Thread[]>(initialThreads);
  const [messages, setMessages]             = useState<Message[]>(initialMessages);
  const [actions, setActions]               = useState<ActionItem[]>(initialActions);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(initialThreadId);
  const [input, setInput]                   = useState("");
  const [loading, setLoading]               = useState(false);
  const [expandedActions, setExpandedActions] = useState<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function toggleActionExpand(id: string) {
    setExpandedActions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function sendMessage(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setLoading(true);
    setInput("");
    try {
      const res = await fetch("/api/copilot/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ message: msg, threadId: activeThreadId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao enviar");
      window.dispatchEvent(new Event("ai-used"));

      setActiveThreadId(data.threadId);
      setMessages(data.messages);
      setActions(data.actionsDraft);

      setThreads((prev) => {
        const exists = prev.find((t) => t.id === data.threadId);
        if (exists) return prev.map((t) => t.id === data.threadId ? { ...t, lastMessageAt: new Date().toISOString() } : t);
        return [{ id: data.threadId, title: msg.slice(0, 40), status: "OPEN", lastMessageAt: new Date().toISOString() }, ...prev.slice(0, 4)];
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
    if (activeThreadId === id) { setActiveThreadId(null); setMessages([]); setActions([]); }
  }

  async function loadThread(id: string) {
    if (id === activeThreadId) return;
    setActiveThreadId(id);
    const res  = await fetch(`/api/copilot/thread?threadId=${id}`);
    const data = await res.json();
    if (res.ok) { setMessages(data.messages); setActions(data.actions); }
  }

  async function updateAction(id: string, path: "approve" | "dismiss") {
    const res = await fetch(`/api/actions/${id}/${path}`, { method: "POST" });
    if (!res.ok) return;
    setActions((prev) => prev.filter((a) => a.id !== id));
  }

  const activeMessages = useMemo(
    () => messages.filter((m) => !activeThreadId || m.threadId === activeThreadId),
    [messages, activeThreadId]
  );

  return (
    // Full-height fixed layout — no page scroll
    <div className="flex h-full overflow-hidden">

      {/* ── Sidebar (desktop only) ──────────────────────────── */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-border bg-surface-900/50">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="text-xs font-semibold text-muted-foreground">Conversas</p>
          <button
            onClick={() => { setActiveThreadId(null); setMessages([]); setActions([]); }}
            className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-surface-700 transition-colors"
            title="Nova conversa"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {threads.length === 0 && <p className="text-xs text-muted-foreground px-1">Sem conversas ainda</p>}
          {threads.map((t) => (
            <div
              key={t.id}
              className={`group relative rounded-lg border text-xs transition-colors ${
                t.id === activeThreadId ? "border-gold-500/40 bg-gold-500/10" : "border-border hover:border-gold-500/20"
              }`}
            >
              <button onClick={() => loadThread(t.id)} className="w-full text-left px-3 py-2 pr-7">
                <p className="font-medium text-foreground truncate">{t.title || "Sem título"}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(t.lastMessageAt).toLocaleDateString("pt-BR")}</p>
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

      {/* ── Main area ───────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">

        {/* ── Chat column ─────────────────────────────────── */}
        <div className="flex flex-col flex-1 overflow-hidden">

          {/* Messages — scrolls internally */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {activeMessages.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-12">
                <div className="rounded-full bg-gold-500/10 border border-gold-500/20 p-4">
                  <Sparkles className="h-7 w-7 text-gold-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Copilot da Barbearia</p>
                  <p className="text-xs text-muted-foreground mt-1">Toque em uma sugestão ou escreva sua pergunta</p>
                </div>
              </div>
            )}

            {activeMessages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "USER" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  m.role === "USER"
                    ? "bg-gold-500/15 border border-gold-500/25 rounded-br-sm"
                    : "bg-surface-800 border border-border rounded-bl-sm"
                }`}>
                  <p className="text-[10px] font-semibold text-muted-foreground mb-1">
                    {m.role === "USER" ? "Você" : "Copilot"}
                  </p>
                  <p className="text-foreground/90 leading-relaxed">{m.content}</p>
                </div>
              </div>
            ))}

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

          {/* Suggestion chips — horizontal scroll */}
          <div className="px-4 pb-2">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none snap-x">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); inputRef.current?.focus(); }}
                  disabled={loading}
                  className="shrink-0 snap-start rounded-full border border-gold-500/30 bg-gold-500/8 px-3 py-1.5 text-xs text-gold-400 hover:bg-gold-500/20 transition-colors disabled:opacity-40 whitespace-nowrap"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Input bar — fixed at bottom of chat column */}
          <div className="px-4 pb-4 pt-1">
            <div className="flex items-end gap-2 rounded-xl border border-border bg-surface-900 px-3 py-2 focus-within:border-gold-500/40 focus-within:ring-1 focus-within:ring-gold-500/20 transition-all">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`; }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
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
            <p className="text-[10px] text-muted-foreground text-center mt-1.5">Enter envia · Shift+Enter nova linha</p>
          </div>
        </div>

        {/* ── Actions column ───────────────────────────────── */}
        {/* Mobile: horizontal swipeable strip above input (rendered before input col) */}
        {/* Desktop: vertical column on the right */}
        {actions.length > 0 && (
          <div className="md:w-72 md:shrink-0 md:border-l md:border-border md:overflow-y-auto">

            {/* Mobile: horizontal scroll strip */}
            <div className="md:hidden px-4 pb-3">
              <p className="text-[11px] font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-gold-400" />
                Ações sugeridas
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{actions.length}</Badge>
              </p>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x">
                {actions.map((a) => (
                  <div key={a.id} className="shrink-0 snap-start w-72 rounded-xl border border-border bg-card p-3 space-y-2">
                    <p className="text-xs font-semibold text-foreground leading-snug">{a.title}</p>
                    {a.description && (
                      <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">{a.description}</p>
                    )}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Button size="sm" className="h-8 text-xs gap-1" onClick={() => updateAction(a.id, "approve")}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-xs gap-1 text-muted-foreground hover:text-red-400 hover:border-red-400/40" onClick={() => updateAction(a.id, "dismiss")}>
                        <Trash2 className="h-3.5 w-3.5" /> Excluir
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop: vertical list */}
            <div className="hidden md:block p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-gold-400" />
                Ações sugeridas
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto">{actions.length}</Badge>
              </p>
              {actions.map((a) => {
                const isExpanded = expandedActions.has(a.id);
                const isLong     = (a.description?.length ?? 0) > 120;
                return (
                  <div key={a.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
                    <p className="text-xs font-semibold text-foreground leading-snug">{a.title}</p>
                    {a.description && (
                      <div>
                        <p className={`text-[11px] text-muted-foreground leading-relaxed ${isExpanded ? "" : "line-clamp-3"}`}>
                          {a.description}
                        </p>
                        {isLong && (
                          <button
                            type="button"
                            onClick={() => toggleActionExpand(a.id)}
                            className="flex items-center gap-0.5 text-[10px] text-gold-400 hover:text-gold-300 mt-0.5"
                          >
                            {isExpanded ? <><ChevronUp className="h-3 w-3" />Ver menos</> : <><ChevronDown className="h-3 w-3" />Ver mais</>}
                          </button>
                        )}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <Button size="sm" className="h-8 text-xs gap-1" onClick={() => updateAction(a.id, "approve")}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-xs gap-1 text-muted-foreground hover:text-red-400 hover:border-red-400/40" onClick={() => updateAction(a.id, "dismiss")}>
                        <Trash2 className="h-3.5 w-3.5" /> Excluir
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function badgeVariant(status: string): "default" | "success" | "warning" | "secondary" | "outline" {
  switch (status) {
    case "APPROVED":  return "success";
    case "EXECUTED":  return "default";
    case "DISMISSED": return "secondary";
    case "EDITED":    return "warning";
    default:          return "outline";
  }
}
