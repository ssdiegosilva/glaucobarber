"use client";

import { useState } from "react";
import { CheckCircle2, Clock, Loader2, MessageCircle, RefreshCw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AdminSupportMessage {
  id:          string;
  body:        string;
  adminReply:  string | null;
  status:      string;
  readByAdmin: boolean;
  createdAt:   string;
  repliedAt:   string | null;
  barbershop:  { id: string; name: string };
  user:        { id: string; name: string | null; email: string | null };
}

const STATUS_LABEL: Record<string, string> = {
  OPEN:    "Aberto",
  REPLIED: "Respondido",
  CLOSED:  "Encerrado",
};

const STATUS_STYLE: Record<string, string> = {
  OPEN:    "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
  REPLIED: "border-green-500/30 bg-green-500/10 text-green-400",
  CLOSED:  "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
};

function formatRelative(iso: string) {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)   return "agora";
  if (mins < 60)  return `${mins}min atrás`;
  if (hours < 24) return `${hours}h atrás`;
  if (days === 1) return "ontem";
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function SupportAdminClient({
  initialMessages,
  initialUnreadCount,
}: {
  initialMessages:    AdminSupportMessage[];
  initialUnreadCount: number;
}) {
  const [messages,     setMessages]     = useState<AdminSupportMessage[]>(initialMessages);
  const [unreadCount,  setUnreadCount]  = useState(initialUnreadCount);
  const [filter,       setFilter]       = useState<"ALL" | "OPEN" | "REPLIED">("ALL");
  const [replies,      setReplies]      = useState<Record<string, string>>({});
  const [sending,      setSending]      = useState<Record<string, boolean>>({});
  const [deletingId,   setDeletingId]   = useState<string | null>(null);
  const [confirmId,    setConfirmId]    = useState<string | null>(null);
  const [refreshing,   setRefreshing]   = useState(false);

  const filtered = messages.filter((m) => filter === "ALL" || m.status === filter);

  async function refresh() {
    setRefreshing(true);
    try {
      const res  = await fetch("/api/admin/support");
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleMarkRead(id: string) {
    await fetch(`/api/admin/support/${id}/read`, { method: "POST" });
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, readByAdmin: true } : m));
    setUnreadCount((n) => Math.max(0, n - 1));
  }

  async function handleReply(id: string) {
    const reply = replies[id]?.trim();
    if (!reply) return;
    setSending((s) => ({ ...s, [id]: true }));
    try {
      const res = await fetch(`/api/admin/support/${id}/reply`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ reply }),
      });
      if (!res.ok) return;
      setMessages((prev) => prev.map((m) =>
        m.id === id
          ? { ...m, adminReply: reply, status: "REPLIED", repliedAt: new Date().toISOString(), readByAdmin: true }
          : m
      ));
      setReplies((r) => { const next = { ...r }; delete next[id]; return next; });
    } finally {
      setSending((s) => ({ ...s, [id]: false }));
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/support/${id}`, { method: "DELETE" });
      if (!res.ok) return;
      const m = messages.find((x) => x.id === id);
      setMessages((prev) => prev.filter((x) => x.id !== id));
      if (m && !m.readByAdmin) setUnreadCount((n) => Math.max(0, n - 1));
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-foreground">Suporte</h1>
          {unreadCount > 0 && (
            <span className="rounded-full bg-gold-500/20 border border-gold-500/30 px-2 py-0.5 text-[11px] font-semibold text-gold-400">
              {unreadCount} não {unreadCount === 1 ? "lida" : "lidas"}
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={refresh}
          disabled={refreshing}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5">
        {(["ALL", "OPEN", "REPLIED"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              filter === f
                ? "border-gold-500/40 bg-gold-500/10 text-gold-400"
                : "border-border bg-surface-800 text-muted-foreground hover:text-foreground",
            )}
          >
            {f === "ALL" ? "Todos" : f === "OPEN" ? "Abertos" : "Respondidos"}
            {f === "OPEN" && messages.filter((m) => m.status === "OPEN").length > 0 && (
              <span className="ml-1.5 rounded-full bg-yellow-500/20 px-1.5 py-0.5 text-yellow-400">
                {messages.filter((m) => m.status === "OPEN").length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Messages */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <MessageCircle className="h-10 w-10 mb-3 text-zinc-700" />
          <p className="text-sm">Nenhuma mensagem {filter !== "ALL" ? "com este filtro" : "ainda"}.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((m) => (
            <div
              key={m.id}
              className={cn(
                "rounded-xl border bg-zinc-900/60 overflow-hidden",
                !m.readByAdmin ? "border-gold-500/40 border-l-2 border-l-gold-500" : "border-zinc-800",
              )}
              onMouseEnter={() => { if (!m.readByAdmin) handleMarkRead(m.id); }}
            >
              {/* Card header */}
              <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">{m.barbershop.name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {m.user.name ?? m.user.email}
                    </span>
                    {!m.readByAdmin && (
                      <span className="rounded-full bg-gold-500/20 border border-gold-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-gold-400">Nova</span>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground">{formatRelative(m.createdAt)}</span>
                </div>
                <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full border shrink-0", STATUS_STYLE[m.status])}>
                  {m.status === "OPEN"    && <Clock className="h-2.5 w-2.5 inline mr-1" />}
                  {m.status === "REPLIED" && <CheckCircle2 className="h-2.5 w-2.5 inline mr-1" />}
                  {m.status === "CLOSED"  && <X className="h-2.5 w-2.5 inline mr-1" />}
                  {STATUS_LABEL[m.status] ?? m.status}
                </span>
              </div>

              {/* User message */}
              <div className="px-4 pb-3">
                <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{m.body}</p>
              </div>

              {/* Existing reply */}
              {m.adminReply && (
                <div className="border-t border-zinc-800 bg-emerald-500/5 px-4 py-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wide">Resposta enviada</p>
                    {m.repliedAt && <span className="text-[11px] text-muted-foreground">{formatRelative(m.repliedAt)}</span>}
                  </div>
                  <p className="text-sm text-foreground/70 leading-relaxed whitespace-pre-wrap">{m.adminReply}</p>
                </div>
              )}

              {/* Reply form (only if not yet replied) */}
              {m.status !== "REPLIED" && m.status !== "CLOSED" && (
                <div className="border-t border-zinc-800 px-4 py-3 space-y-2">
                  <textarea
                    value={replies[m.id] ?? ""}
                    onChange={(e) => setReplies((r) => ({ ...r, [m.id]: e.target.value }))}
                    placeholder="Escreva uma resposta..."
                    rows={3}
                    className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <div className="flex items-center justify-between gap-2">
                    {/* Delete confirm */}
                    {confirmId === m.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-400">Confirmar exclusão?</span>
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 text-xs text-red-400 hover:bg-red-500/10"
                          onClick={() => handleDelete(m.id)}
                          disabled={deletingId === m.id}
                        >
                          {deletingId === m.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Sim, deletar"}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConfirmId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-1"
                        onClick={() => setConfirmId(m.id)}
                      >
                        <Trash2 className="h-3 w-3" /> Deletar
                      </Button>
                    )}

                    <Button
                      size="sm"
                      className="bg-gold-500 hover:bg-gold-400 text-black h-8 text-xs gap-1.5"
                      disabled={!replies[m.id]?.trim() || sending[m.id]}
                      onClick={() => handleReply(m.id)}
                    >
                      {sending[m.id]
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <CheckCircle2 className="h-3.5 w-3.5" />}
                      {sending[m.id] ? "Enviando..." : "Responder"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Only delete when already replied */}
              {(m.status === "REPLIED" || m.status === "CLOSED") && (
                <div className="border-t border-zinc-800 px-4 py-2 flex justify-end">
                  {confirmId === m.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-400">Confirmar exclusão?</span>
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 text-xs text-red-400 hover:bg-red-500/10"
                        onClick={() => handleDelete(m.id)}
                        disabled={deletingId === m.id}
                      >
                        {deletingId === m.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Sim, deletar"}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConfirmId(null)}>
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm" variant="ghost"
                      className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-1"
                      onClick={() => setConfirmId(m.id)}
                    >
                      <Trash2 className="h-3 w-3" /> Deletar
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
