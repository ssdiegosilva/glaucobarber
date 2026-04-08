"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageCircle, Send, Clock, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SupportMessageDto {
  id:         string;
  body:       string;
  adminReply: string | null;
  status:     string;
  createdAt:  string;
  repliedAt:  string | null;
}

const STATUS_LABEL: Record<string, string> = {
  OPEN:    "Aguardando resposta",
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

export function SupportClient({ initialMessages }: { initialMessages: SupportMessageDto[] }) {
  const [messages, setMessages] = useState<SupportMessageDto[]>(initialMessages);
  const [body,     setBody]     = useState("");
  const [sending,  setSending]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [toast,    setToast]    = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const loadMessages = useCallback(async () => {
    try {
      const res  = await fetch("/api/support");
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch {}
  }, []);

  useEffect(() => {
    const interval = setInterval(loadMessages, 30_000);
    window.addEventListener("support-updated", loadMessages);
    return () => {
      clearInterval(interval);
      window.removeEventListener("support-updated", loadMessages);
    };
  }, [loadMessages]);

  async function handleSend() {
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res  = await fetch("/api/support", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ body: body.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erro ao enviar mensagem"); return; }
      setBody("");
      await loadMessages();
      window.dispatchEvent(new Event("support-updated"));
      showToast("Mensagem enviada! Responderemos em breve.");
    } catch {
      setError("Erro ao enviar mensagem. Tente novamente.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-auto p-4 sm:p-6 space-y-6 max-w-2xl">

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-lg px-4 py-3 text-sm shadow-xl border bg-zinc-900 border-emerald-500/30 text-emerald-400">
          {toast}
        </div>
      )}

      {/* Compose */}
      <div className="rounded-xl border border-border/60 bg-surface-900 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-gold-400" />
          <h2 className="text-sm font-semibold text-foreground">Nova mensagem</h2>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Descreva sua dúvida, problema ou sugestão..."
          rows={4}
          maxLength={2000}
          className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground/50">{body.length}/2000</span>
          <div className="flex items-center gap-2">
            {error && <span className="text-xs text-red-400">{error}</span>}
            <Button
              onClick={handleSend}
              disabled={sending || !body.trim()}
              className="bg-gold-500 hover:bg-gold-400 text-black gap-1.5 h-8 text-xs"
            >
              {sending ? (
                <div className="h-3.5 w-3.5 border-2 border-black/40 border-t-black rounded-full animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              {sending ? "Enviando..." : "Enviar mensagem"}
            </Button>
          </div>
        </div>
      </div>

      {/* Messages list */}
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <MessageCircle className="h-10 w-10 mb-3 text-zinc-700" />
          <p className="text-sm">Nenhuma mensagem ainda. Envie sua primeira mensagem acima!</p>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Suas mensagens <span className="text-zinc-500">({messages.length})</span>
          </h2>
          {messages.map((m) => (
            <div key={m.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
              {/* User message */}
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full border", STATUS_STYLE[m.status])}>
                    {m.status === "OPEN"    && <Clock className="h-2.5 w-2.5 inline mr-1" />}
                    {m.status === "REPLIED" && <CheckCircle2 className="h-2.5 w-2.5 inline mr-1" />}
                    {m.status === "CLOSED"  && <X className="h-2.5 w-2.5 inline mr-1" />}
                    {STATUS_LABEL[m.status] ?? m.status}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{formatRelative(m.createdAt)}</span>
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{m.body}</p>
              </div>

              {/* Admin reply */}
              {m.adminReply && (
                <div className="border-t border-zinc-800 bg-emerald-500/5 p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wide">Resposta do suporte</p>
                    {m.repliedAt && (
                      <span className="text-[11px] text-muted-foreground">{formatRelative(m.repliedAt)}</span>
                    )}
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{m.adminReply}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
