"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MessageCircle, Clock, CheckCircle2, XCircle, Send,
  Trash2, RotateCcw, Users, CalendarDays, Star, RefreshCcw, Loader2, Pencil, X, PenLine,
} from "lucide-react";
import { formatBRL } from "@/lib/utils";

type WaMessage = {
  id:           string;
  customerId:   string | null;
  customerName: string;
  phone:        string;
  message:      string;
  type:         string;
  status:       string;
  actionId:     string | null;
  sentAt:       string | null;
  scheduledFor: string | null;
  createdAt:    string;
};

interface Props {
  todayMessages:     WaMessage[];
  queueMessages:     WaMessage[];
  historyMessages:   WaMessage[];
  scheduledMessages: WaMessage[];
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

// ── Compose custom message modal ─────────────────────────────

function ComposeModal({ onClose, onSent }: { onClose: () => void; onSent: (msg: WaMessage) => void }) {
  const [name,         setName]         = useState("");
  const [phone,        setPhone]        = useState("");
  const [text,         setText]         = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [sending,      setSending]      = useState(false);
  const [error,        setError]        = useState("");
  const todayStr = new Date().toISOString().slice(0, 10);

  async function send() {
    if (!name.trim() || !phone.trim() || !text.trim()) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/whatsapp/messages", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          customerName: name.trim(),
          phone:        phone.trim(),
          message:      text.trim(),
          type:         "general",
          messageKind:  "text",
          scheduledFor: scheduledFor || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      onSent(data.message);
      onClose();
    } catch {
      setError("Erro ao enviar mensagem.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-50" onClick={onClose} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[60] rounded-xl border border-border bg-card shadow-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto max-w-md mx-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Mensagem personalizada</h3>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Nome do cliente</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="João Silva"
              className="mt-1 w-full rounded-md border border-border bg-surface-900 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Telefone (com DDD)</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="11999998888"
              className="mt-1 w-full rounded-md border border-border bg-surface-900 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Mensagem</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder="Digite a mensagem..."
              className="mt-1 w-full rounded-md border border-border bg-surface-900 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Agendar para (opcional)</label>
            <input
              type="date"
              value={scheduledFor}
              min={todayStr}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-surface-900 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
          Mensagens personalizadas só funcionam dentro da janela de 24h de conversa ativa. Fora desse período, use um template aprovado pela Meta.
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={sending}>Cancelar</Button>
          <Button className="flex-1 gap-2" onClick={send} disabled={sending || !name || !phone || !text}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {scheduledFor ? "Agendar" : "Enviar agora"}
          </Button>
        </div>
      </div>
    </>
  );
}

// ── Edit modal for queued messages ───────────────────────────

function EditMessageModal({
  msg,
  onClose,
  onSaved,
}: {
  msg:     WaMessage;
  onClose: () => void;
  onSaved: (updated: WaMessage) => void;
}) {
  const [text,         setText]         = useState(msg.message);
  const [scheduledFor, setScheduledFor] = useState(
    msg.scheduledFor ? msg.scheduledFor.slice(0, 10) : ""
  );
  const [saving, setSaving] = useState(false);
  const todayStr = new Date().toISOString().slice(0, 10);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/whatsapp/messages/${msg.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          message:      text.trim(),
          scheduledFor: scheduledFor || null,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      onSaved(data.message);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-50" onClick={onClose} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[60] rounded-xl border border-border bg-card shadow-2xl p-5 space-y-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Editar mensagem</h3>
            <p className="text-xs text-muted-foreground">{msg.customerName} · {msg.phone}</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {msg.scheduledFor && (
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

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Mensagem</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            className="w-full rounded-md border border-border bg-surface-900 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={save} disabled={saving || !text.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Salvar
          </Button>
        </div>
      </div>
    </>
  );
}

// ── Message row ───────────────────────────────────────────────

function MessageRow({
  msg,
  showActions,
  onSent,
  onFailed,
  onDelete,
  onEdit,
}: {
  msg:        WaMessage;
  showActions?: boolean;
  onSent?:    (id: string) => void;
  onFailed?:  (id: string) => void;
  onDelete?:  (id: string) => void;
  onEdit?:    (updated: WaMessage) => void;
}) {
  const [loading,   setLoading]   = useState(false);
  const [showEdit,  setShowEdit]  = useState(false);
  const [localMsg,  setLocalMsg]  = useState(msg);

  async function send() {
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/messages", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          customerId:   localMsg.customerId ?? undefined,
          customerName: localMsg.customerName,
          phone:        localMsg.phone,
          message:      localMsg.message,
          type:         localMsg.type,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.message?.status === "SENT") {
        onSent?.(localMsg.id);
        onDelete?.(localMsg.id);
        await fetch(`/api/whatsapp/messages/${localMsg.id}`, { method: "DELETE" });
      } else {
        onFailed?.(localMsg.id);
      }
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    setLoading(true);
    try {
      await fetch(`/api/whatsapp/messages/${localMsg.id}`, { method: "DELETE" });
      onDelete?.(localMsg.id);
    } finally {
      setLoading(false);
    }
  }

  function handleSaved(updated: WaMessage) {
    setLocalMsg(updated);
    onEdit?.(updated);
  }

  return (
    <>
      <div className="rounded-lg border border-border bg-surface-800/60 p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-foreground truncate">{localMsg.customerName}</span>
            <span className="text-xs text-muted-foreground shrink-0">{localMsg.phone}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
              {typeIcon(localMsg.type)}{typeLabel(localMsg.type)}
            </span>
            {localMsg.status === "SENT"   && <CheckCircle2 className="h-4 w-4 text-green-400" />}
            {localMsg.status === "FAILED" && <XCircle      className="h-4 w-4 text-red-400"   />}
            {localMsg.status === "QUEUED" && <Clock        className="h-4 w-4 text-yellow-400" />}
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{localMsg.message}</p>

        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-muted-foreground">
            {localMsg.sentAt
              ? `Enviado ${formatDate(localMsg.sentAt)}`
              : localMsg.scheduledFor
              ? `Agendado para ${formatDate(localMsg.scheduledFor)}`
              : formatDate(localMsg.createdAt)}
          </span>

          {showActions && localMsg.status === "QUEUED" && (
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                onClick={send}
                disabled={loading}
                className="inline-flex items-center gap-1 rounded-md border border-green-500/40 bg-green-500/10 px-2 py-1 text-[11px] text-green-400 hover:bg-green-500/20 transition-colors h-auto"
              >
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                Enviar
              </Button>
              <Button
                size="icon-sm" variant="ghost"
                onClick={() => setShowEdit(true)}
                disabled={loading}
                title="Editar mensagem"
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
              <Button size="icon-sm" variant="ghost" onClick={remove} disabled={loading} title="Remover da fila">
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {showEdit && (
        <EditMessageModal
          msg={localMsg}
          onClose={() => setShowEdit(false)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}

// ── Main client ───────────────────────────────────────────────

export function WhatsappClient({ todayMessages, queueMessages, historyMessages, scheduledMessages }: Props) {
  const [tab, setTab] = useState<"today" | "queue" | "scheduled" | "history">("today");
  const [today,     setToday]     = useState<WaMessage[]>(todayMessages);
  const [queue,     setQueue]     = useState<WaMessage[]>(queueMessages);
  const [history,   setHistory]   = useState<WaMessage[]>(historyMessages);
  const [scheduled, setScheduled] = useState<WaMessage[]>(scheduledMessages);
  const [processing,   setProcessing]   = useState(false);
  const [processResult, setProcessResult] = useState<{ sent: number; failed: number } | null>(null);
  const [showCompose, setShowCompose] = useState(false);

  async function processQueue() {
    setProcessing(true);
    setProcessResult(null);
    try {
      const res = await fetch("/api/whatsapp/process-queue", { method: "POST" });
      const data = await res.json();
      setProcessResult({ sent: data.sent ?? 0, failed: data.failed ?? 0 });
      // Move mensagens enviadas para histórico
      setQueue((prev) => prev.map((m) => ({ ...m, status: data.sent > 0 ? "SENT" : m.status })));
      setTimeout(() => window.location.reload(), 1500);
    } finally {
      setProcessing(false);
    }
  }

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
    setScheduled((prev) => prev.filter((m) => m.id !== id));
  }

  function updateMessage(updated: WaMessage) {
    const apply = (list: WaMessage[]) =>
      list.map((m) => m.id === updated.id ? updated : m);
    setQueue(apply);
    setScheduled(apply);
    setToday(apply);
  }

  const sentToday   = today.filter((m) => m.status === "SENT").length;
  const queuedToday = today.filter((m) => m.status === "QUEUED").length;
  const failedToday = today.filter((m) => m.status === "FAILED").length;

  const [todayFilter, setTodayFilter] = useState<"all" | "SENT" | "QUEUED" | "FAILED">("all");

  function toggleTodayFilter(f: "SENT" | "QUEUED" | "FAILED") {
    setTodayFilter((prev) => (prev === f ? "all" : f));
  }

  const todayFiltered = todayFilter === "all" ? today : today.filter((m) => m.status === todayFilter);

  const TABS = [
    { id: "today"     as const, label: "Hoje",      badge: today.length     },
    { id: "queue"     as const, label: "Fila",      badge: queue.length     },
    { id: "scheduled" as const, label: "Agendadas", badge: scheduled.length },
    { id: "history"   as const, label: "Histórico", badge: history.length   },
  ];

  function handleComposeSent(msg: WaMessage) {
    setToday((prev) => [msg, ...prev]);
    if (msg.scheduledFor) setScheduled((prev) => [msg, ...prev]);
    else setQueue((prev) => [msg, ...prev]);
  }

  return (
    <div className="flex-1 p-6 space-y-5 overflow-y-auto">
      {/* Header with compose button */}
      <div className="flex items-center justify-between">
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
        <Button size="sm" onClick={() => setShowCompose(true)} className="gap-1.5 shrink-0">
          <PenLine className="h-4 w-4" />
          Mensagem personalizada
        </Button>
      </div>

      {showCompose && (
        <ComposeModal onClose={() => setShowCompose(false)} onSent={handleComposeSent} />
      )}

      {/* TODAY */}
      {tab === "today" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {([
              { status: "SENT"   as const, label: "Enviadas", value: sentToday,   icon: <CheckCircle2 className="h-4 w-4 text-green-400"  />, color: "bg-green-500/10 border-green-500/20",   active: "border-green-400 ring-1 ring-green-400/40"   },
              { status: "QUEUED" as const, label: "Na fila",  value: queuedToday, icon: <Clock        className="h-4 w-4 text-yellow-400" />, color: "bg-yellow-500/10 border-yellow-500/20", active: "border-yellow-400 ring-1 ring-yellow-400/40" },
              { status: "FAILED" as const, label: "Falha",    value: failedToday, icon: <XCircle      className="h-4 w-4 text-red-400"    />, color: "bg-red-500/10 border-red-500/20",       active: "border-red-400 ring-1 ring-red-400/40"       },
            ]).map(({ status, label, value, icon, color, active }) => (
              <button
                key={status}
                onClick={() => toggleTodayFilter(status)}
                className={`rounded-xl border p-4 text-left transition-all focus:outline-none cursor-pointer ${
                  todayFilter === status ? active : color
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center justify-center rounded-lg p-2 border ${color}`}>{icon}</span>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                </div>
                {todayFilter === status && (
                  <p className="text-[10px] text-muted-foreground mt-1.5">filtro ativo · clique para limpar</p>
                )}
              </button>
            ))}
          </div>

          {today.length === 0 ? (
            <div className="rounded-lg border border-border p-8 text-center">
              <MessageCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma comunicação hoje.</p>
              <p className="text-xs text-muted-foreground mt-1">Aprove ações no Copilot para enfileirar mensagens.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {todayFiltered.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Nenhuma mensagem com status &quot;{todayFilter}&quot; hoje.
                </p>
              ) : (
                todayFiltered.map((m) => (
                  <MessageRow
                    key={m.id}
                    msg={m}
                    showActions={m.status === "QUEUED" || m.status === "FAILED"}
                    onSent={markSent}
                    onFailed={markFailed}
                    onDelete={removeFromQueue}
                    onEdit={updateMessage}
                  />
                ))
              )}
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
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {queue.length} mensage{queue.length !== 1 ? "ns" : "m"} aguardando envio.
                </p>
                <Button
                  size="sm"
                  onClick={processQueue}
                  disabled={processing}
                  className="inline-flex items-center gap-1.5 rounded-md bg-gold-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-gold-400 transition-colors h-auto"
                >
                  {processing
                    ? <><Loader2 className="h-3 w-3 animate-spin" /> Processando...</>
                    : <><Send className="h-3 w-3" /> Enviar tudo</>}
                </Button>
              </div>
              {processResult && (
                <div className={`rounded-md border px-3 py-2 text-xs ${processResult.failed > 0 ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-green-500/30 bg-green-500/10 text-green-400"}`}>
                  {processResult.sent} enviada{processResult.sent !== 1 ? "s" : ""}
                  {processResult.failed > 0 && `, ${processResult.failed} com falha`}
                  {" — atualizando..."}
                </div>
              )}
              {queue.map((m) => (
                <MessageRow
                  key={m.id}
                  msg={m}
                  showActions
                  onSent={markSent}
                  onFailed={markFailed}
                  onDelete={removeFromQueue}
                  onEdit={updateMessage}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* SCHEDULED */}
      {tab === "scheduled" && (
        <div className="space-y-3">
          {scheduled.length === 0 ? (
            <div className="rounded-lg border border-border p-8 text-center">
              <CalendarDays className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma mensagem agendada.</p>
              <p className="text-xs text-muted-foreground mt-1">Agende envios no Pós-venda para aparecerem aqui.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {scheduled.length} mensage{scheduled.length !== 1 ? "ns" : "m"} com envio programado.
              </p>
              {scheduled.map((m) => (
                <MessageRow
                  key={m.id}
                  msg={m}
                  showActions
                  onSent={markSent}
                  onFailed={markFailed}
                  onDelete={removeFromQueue}
                  onEdit={updateMessage}
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
