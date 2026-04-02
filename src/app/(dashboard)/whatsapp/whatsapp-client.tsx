"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MessageCircle, Clock, CheckCircle2, XCircle, Send,
  Trash2, RotateCcw, Users, CalendarDays, Star, RefreshCcw,
} from "lucide-react";
import { formatBRL } from "@/lib/utils";

type WaMessage = {
  id:          string;
  customerName: string;
  phone:       string;
  message:     string;
  type:        string;
  status:      string;
  actionId:    string | null;
  sentAt:      string | null;
  createdAt:   string;
};

interface Props {
  todayMessages:   WaMessage[];
  queueMessages:   WaMessage[];
  historyMessages: WaMessage[];
}

const TYPE_LABEL: Record<string, string> = {
  reactivation:         "Reativação",
  reactivation_promo:   "Promoção",
  post_sale_followup:   "Pós-venda",
  post_sale_review:     "Avaliação",
  agenda_conflict:      "Reagendamento",
  general:              "Geral",
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  reactivation:       <RotateCcw   className="h-3 w-3" />,
  reactivation_promo: <RefreshCcw  className="h-3 w-3" />,
  post_sale_followup: <Users       className="h-3 w-3" />,
  post_sale_review:   <Star        className="h-3 w-3" />,
  agenda_conflict:    <CalendarDays className="h-3 w-3" />,
  general:            <MessageCircle className="h-3 w-3" />,
};

function typeLabel(type: string) {
  return TYPE_LABEL[type] ?? type;
}
function typeIcon(type: string) {
  return TYPE_ICON[type] ?? <MessageCircle className="h-3 w-3" />;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function buildWhatsappLink(phone: string, message: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

// ── Stat card for today's dashboard ──────────────────────────

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <Card className="border-border/60 bg-surface-900">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center justify-center rounded-lg p-2 border ${color}`}>{icon}</span>
          <div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Message row ───────────────────────────────────────────────

function MessageRow({
  msg,
  showActions,
  onSent,
  onFailed,
  onDelete,
}: {
  msg:        WaMessage;
  showActions?: boolean;
  onSent?:    (id: string) => void;
  onFailed?:  (id: string) => void;
  onDelete?:  (id: string) => void;
}) {
  const [loading, setLoading] = useState(false);

  async function patch(status: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/whatsapp/messages/${msg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) return;
      if (status === "SENT") onSent?.(msg.id);
      if (status === "FAILED") onFailed?.(msg.id);
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    setLoading(true);
    try {
      await fetch(`/api/whatsapp/messages/${msg.id}`, { method: "DELETE" });
      onDelete?.(msg.id);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface-800/60 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-foreground truncate">{msg.customerName}</span>
          <span className="text-xs text-muted-foreground shrink-0">{msg.phone}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
            {typeIcon(msg.type)}{typeLabel(msg.type)}
          </span>
          {msg.status === "SENT"   && <CheckCircle2 className="h-4 w-4 text-green-400" />}
          {msg.status === "FAILED" && <XCircle      className="h-4 w-4 text-red-400"   />}
          {msg.status === "QUEUED" && <Clock        className="h-4 w-4 text-yellow-400" />}
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{msg.message}</p>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-muted-foreground">
          {msg.sentAt ? `Enviado ${formatDate(msg.sentAt)}` : formatDate(msg.createdAt)}
        </span>

        {showActions && msg.status === "QUEUED" && (
          <div className="flex gap-1.5">
            <a
              href={buildWhatsappLink(msg.phone, msg.message)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setTimeout(() => patch("SENT"), 1500)}
              className="inline-flex items-center gap-1 rounded-md border border-green-500/40 bg-green-500/10 px-2 py-1 text-[11px] text-green-400 hover:bg-green-500/20 transition-colors"
            >
              <Send className="h-3 w-3" /> Enviar WhatsApp
            </a>
            <Button size="icon-sm" variant="ghost" onClick={() => patch("FAILED")} disabled={loading} title="Marcar como falha">
              <XCircle className="h-3.5 w-3.5 text-red-400" />
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={remove} disabled={loading} title="Remover">
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main client ───────────────────────────────────────────────

export function WhatsappClient({ todayMessages, queueMessages, historyMessages }: Props) {
  const [tab, setTab] = useState<"today" | "queue" | "history">("today");
  const [today,   setToday]   = useState<WaMessage[]>(todayMessages);
  const [queue,   setQueue]   = useState<WaMessage[]>(queueMessages);
  const [history, setHistory] = useState<WaMessage[]>(historyMessages);

  function markSent(id: string) {
    const msg = queue.find((m) => m.id === id);
    setQueue((prev) => prev.filter((m) => m.id !== id));
    if (msg) {
      const sent = { ...msg, status: "SENT", sentAt: new Date().toISOString() };
      setHistory((prev) => [sent, ...prev]);
      setToday((prev) => prev.map((m) => m.id === id ? sent : m));
    }
  }

  function markFailed(id: string) {
    setQueue((prev) => prev.map((m) => m.id === id ? { ...m, status: "FAILED" } : m));
    setToday((prev) => prev.map((m) => m.id === id ? { ...m, status: "FAILED" } : m));
  }

  function removeFromQueue(id: string) {
    setQueue((prev) => prev.filter((m) => m.id !== id));
    setToday((prev) => prev.filter((m) => m.id !== id));
  }

  const sentToday   = today.filter((m) => m.status === "SENT").length;
  const queuedToday = today.filter((m) => m.status === "QUEUED").length;
  const failedToday = today.filter((m) => m.status === "FAILED").length;

  const TABS = [
    { id: "today" as const,   label: "Hoje",      badge: today.length },
    { id: "queue" as const,   label: "Fila",      badge: queue.length },
    { id: "history" as const, label: "Histórico", badge: history.length },
  ];

  return (
    <div className="flex-1 p-6 space-y-5 overflow-y-auto">
      {/* Tabs */}
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "border-gold-500/40 bg-gold-500/10 text-gold-400"
                : "border-border text-muted-foreground hover:border-gold-500/20 hover:text-foreground"
            }`}
          >
            {t.label}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              tab === t.id ? "bg-gold-500/20 text-gold-400" : "bg-surface-700 text-muted-foreground"
            }`}>{t.badge}</span>
          </button>
        ))}
      </div>

      {/* TODAY */}
      {tab === "today" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Enviadas" value={sentToday}   icon={<CheckCircle2 className="h-4 w-4 text-green-400"  />} color="bg-green-500/10 border-green-500/20"  />
            <StatCard label="Na fila"  value={queuedToday} icon={<Clock        className="h-4 w-4 text-yellow-400" />} color="bg-yellow-500/10 border-yellow-500/20" />
            <StatCard label="Falha"    value={failedToday} icon={<XCircle      className="h-4 w-4 text-red-400"    />} color="bg-red-500/10 border-red-500/20"       />
          </div>

          {today.length === 0 ? (
            <div className="rounded-lg border border-border p-8 text-center">
              <MessageCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma comunicação hoje.</p>
              <p className="text-xs text-muted-foreground mt-1">Aprove ações no Copilot para enfileirar mensagens.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {today.map((m) => (
                <MessageRow key={m.id} msg={m} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* QUEUE */}
      {tab === "queue" && (
        <div className="space-y-3">
          {queue.length === 0 ? (
            <div className="rounded-lg border border-border p-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Fila vazia — tudo enviado!</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {queue.length} mensage{queue.length !== 1 ? "ns" : "m"} aguardando envio.
                Clique em "Enviar WhatsApp" para abrir o WhatsApp Web já com a mensagem preenchida.
              </p>
              {queue.map((m) => (
                <MessageRow
                  key={m.id}
                  msg={m}
                  showActions
                  onSent={markSent}
                  onFailed={markFailed}
                  onDelete={removeFromQueue}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* HISTORY */}
      {tab === "history" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Mensagens enviadas nos últimos 30 dias.</p>
          {history.length === 0 ? (
            <div className="rounded-lg border border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">Nenhuma mensagem enviada ainda.</p>
            </div>
          ) : (
            history.map((m) => <MessageRow key={m.id} msg={m} />)
          )}
        </div>
      )}
    </div>
  );
}
