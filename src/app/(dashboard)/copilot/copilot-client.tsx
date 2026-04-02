"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, CheckCircle2, XCircle, Play, MessageSquare, Sparkles, PanelsTopLeft } from "lucide-react";

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
  initialThreads: Thread[];
  initialMessages: Message[];
  initialActions: ActionItem[];
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
  const [threads, setThreads] = useState<Thread[]>(initialThreads);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [actions, setActions]   = useState<ActionItem[]>(initialActions);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(initialThreadId);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showActionsMobile, setShowActionsMobile] = useState(false);

  async function sendMessage() {
    if (!input.trim() || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/copilot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input, threadId: activeThreadId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao enviar");

      setActiveThreadId(data.threadId);
      setMessages(data.messages);
      setActions((prev) => [...data.actionsDraft, ...prev]);

      // add thread if new
      setThreads((prev) => {
        const exists = prev.find((t) => t.id === data.threadId);
        if (exists) return prev.map((t) => (t.id === data.threadId ? { ...t, lastMessageAt: new Date().toISOString() } : t));
        return [
          { id: data.threadId, title: input.slice(0, 40), status: "OPEN", lastMessageAt: new Date().toISOString() },
          ...prev,
        ];
      });
      setInput("");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function sendMessageWith(question: string) {
    if (loading) return;
    setLoading(true);
    setInput("");
    try {
      const res = await fetch("/api/copilot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, threadId: activeThreadId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao enviar");

      setActiveThreadId(data.threadId);
      setMessages(data.messages);
      setActions((prev) => [...data.actionsDraft, ...prev]);

      setThreads((prev) => {
        const exists = prev.find((t) => t.id === data.threadId);
        if (exists) return prev.map((t) => (t.id === data.threadId ? { ...t, lastMessageAt: new Date().toISOString() } : t));
        return [
          { id: data.threadId, title: question.slice(0, 40), status: "OPEN", lastMessageAt: new Date().toISOString() },
          ...prev,
        ];
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadThread(id: string) {
    if (id === activeThreadId) return;
    setActiveThreadId(id);
    const res = await fetch(`/api/copilot/thread?threadId=${id}`);
    const data = await res.json();
    if (res.ok) {
      setMessages(data.messages);
      setActions(data.actions);
    }
  }

  async function updateAction(id: string, path: "approve" | "dismiss" | "execute") {
    const res = await fetch(`/api/actions/${id}/${path}`, { method: "POST" });
    if (!res.ok) return;
    setActions((prev) => prev.map((a) => (a.id === id ? { ...a, status: path === "execute" ? "EXECUTED" : path === "approve" ? "APPROVED" : "DISMISSED" } : a)));
  }

  const activeMessages = useMemo(() => messages.filter((m) => !activeThreadId || m.threadId === activeThreadId), [messages, activeThreadId]);

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-surface-900/50 p-4 space-y-3 hidden md:block">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground">Conversas</p>
          <Button size="icon" variant="ghost" onClick={() => { setActiveThreadId(null); setMessages([]); }}>
            <MessageSquare className="h-4 w-4" />
          </Button>
        </div>
        <div className="h-[calc(100vh-180px)] pr-2 overflow-y-auto">
          {threads.length === 0 && <p className="text-xs text-muted-foreground">Sem threads ainda</p>}
          <div className="space-y-2">
            {threads.map((t) => (
              <button
                key={t.id}
                onClick={() => loadThread(t.id)}
                className={`w-full text-left rounded-md border px-3 py-2 text-xs transition-colors ${
                  t.id === activeThreadId ? "border-gold-500/40 bg-gold-500/10" : "border-border hover:border-gold-500/20"
                }`}
              >
                <p className="font-semibold text-foreground truncate">{t.title || "Sem título"}</p>
                <p className="text-[10px] text-muted-foreground">{new Date(t.lastMessageAt).toLocaleString()}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 p-4 md:p-6 space-y-3">
        {/* mobile header for actions toggle */}
        <div className="md:hidden flex gap-2">
          <Button variant={showActionsMobile ? "outline" : "default"} size="sm" className="flex-1" onClick={() => setShowActionsMobile(false)}>
            <MessageSquare className="h-4 w-4 mr-1" /> Chat
          </Button>
          <Button variant={showActionsMobile ? "default" : "outline"} size="sm" className="flex-1" onClick={() => setShowActionsMobile(true)}>
            <PanelsTopLeft className="h-4 w-4 mr-1" /> Ações
          </Button>
        </div>

        <div className={`grid grid-cols-1 lg:grid-cols-3 gap-4 ${showActionsMobile ? "md:grid" : ""}`}>
          <div className={`flex flex-col h-full ${showActionsMobile ? "hidden md:flex" : "col-span-2 lg:col-span-2"}`}>
          <Card className="flex-1 flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-gold-400" />
                <CardTitle className="text-sm">Chat</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4">
              <div className="flex-1 rounded-md border border-border p-4 overflow-y-auto">
                <div className="space-y-4">
                  {activeMessages.map((m) => (
                    <div key={m.id} className={`flex ${m.role === "USER" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-xl rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                        m.role === "USER" ? "bg-gold-500/15 border border-gold-500/30" : "bg-surface-800 border border-border"
                      }`}>
                        <p className="font-semibold text-[11px] text-muted-foreground mb-1">{m.role === "USER" ? "Você" : "Copilot"}</p>
                        <p className="text-foreground/90">{m.content}</p>
                        {Array.isArray(m.actionsJson) && m.actionsJson.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {m.actionsJson.map((a: any, idx: number) => (
                              <div key={idx} className="text-xs text-muted-foreground">• {a.title}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {activeMessages.length === 0 && (
                    <p className="text-xs text-muted-foreground">Envie sua primeira pergunta para o Copilot.</p>
                  )}
                </div>
              </div>

              {/* Pre-configured question chips */}
              <div className="flex flex-wrap gap-2">
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); setTimeout(() => sendMessageWith(q), 0); }}
                    disabled={loading}
                    className="rounded-full border border-gold-500/30 bg-gold-500/10 px-3 py-1 text-xs text-gold-400 hover:bg-gold-500/20 transition-colors disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ou escreva sua própria pergunta..."
                  onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
                  className="flex-1 rounded-md border border-border bg-surface-900 px-3 py-2 text-sm text-foreground"
                />
                <Button onClick={sendMessage} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>
          </div>

          {/* Actions column */}
          <div className={`flex flex-col gap-3 ${showActionsMobile ? "block" : "hidden md:flex"}`}>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 justify-between">
                  <CardTitle className="text-sm">Ações sugeridas</CardTitle>
                  <Badge variant="outline">{actions.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {actions.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma ação pendente</p>}
                {actions.map((a) => (
                  <div key={a.id} className="rounded-md border border-border p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">{a.title}</p>
                      <Badge variant={badgeVariant(a.status)} className="text-[10px]">{a.status}</Badge>
                    </div>
                    {a.description && <p className="text-xs text-muted-foreground line-clamp-3">{a.description}</p>}
                    <p className="text-[10px] text-muted-foreground">Tipo: {a.type}</p>
                    <div className="flex gap-2 pt-1">
                      <Button size="icon-sm" variant="outline" onClick={() => updateAction(a.id, "approve")} title="Aprovar">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon-sm" variant="outline" onClick={() => updateAction(a.id, "execute")} title="Executar">
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon-sm" variant="ghost" onClick={() => updateAction(a.id, "dismiss")} title="Dispensar">
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function badgeVariant(status: string): "default" | "success" | "warning" | "secondary" | "outline" {
  switch (status) {
    case "APPROVED":
      return "success" as const;
    case "EXECUTED":
      return "default" as const;
    case "DISMISSED":
      return "secondary" as const;
    case "EDITED":
      return "warning" as const;
    default:
      return "outline" as const;
  }
}
