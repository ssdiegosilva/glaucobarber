"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  MessageCircle, Clock, CheckCircle2, XCircle, Send,
  Trash2, RotateCcw, Users, CalendarDays, Star, RefreshCcw,
  Loader2, Pencil, X, PenLine, Search, History, FileText,
  ExternalLink, AlertCircle,
} from "lucide-react";
import { TemplatesTab } from "./templates-tab";

// ── Types ─────────────────────────────────────────────────────

type WaMessage = {
  id:            string;
  customerId:    string | null;
  customerName:  string;
  phone:         string;
  message:       string;
  type:          string;
  status:        string;
  actionId:      string | null;
  sentAt:        string | null;
  scheduledFor:  string | null;
  createdAt:     string;
  metaMessageId: string | null | undefined;
  errorMessage:  string | null | undefined;
};

interface Props {
  sentToday:      WaMessage[];
  queueMessages:  WaMessage[];
  failedToday:    WaMessage[];
  historyMessages: WaMessage[];
}

// ── Helpers ───────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  reactivation:       "Reativação",
  reactivation_promo: "Promoção",
  post_sale_followup: "Pós-venda",
  post_sale_review:   "Avaliação",
  agenda_conflict:    "Reagendamento",
  general:            "Geral",
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  reactivation:       <RotateCcw    className="h-3 w-3" />,
  reactivation_promo: <RefreshCcw   className="h-3 w-3" />,
  post_sale_followup: <Users        className="h-3 w-3" />,
  post_sale_review:   <Star         className="h-3 w-3" />,
  agenda_conflict:    <CalendarDays className="h-3 w-3" />,
  general:            <MessageCircle className="h-3 w-3" />,
};

function typeLabel(t: string) { return TYPE_LABEL[t] ?? t; }
function typeIcon(t: string)  { return TYPE_ICON[t]  ?? <MessageCircle className="h-3 w-3" />; }

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

// ── Compose modal ─────────────────────────────────────────────

type CustomerSuggestion = { id: string; name: string; phone: string | null };

function ComposeModal({ onClose, onSent }: { onClose: () => void; onSent: (msg: WaMessage) => void }) {
  const [customerId,   setCustomerId]   = useState<string | null>(null);
  const [name,         setName]         = useState("");
  const [phone,        setPhone]        = useState("");
  const [text,         setText]         = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [sending,      setSending]      = useState(false);
  const [error,        setError]        = useState("");
  const [query,        setQuery]        = useState("");
  const [suggestions,  setSuggestions]  = useState<CustomerSuggestion[]>([]);
  const [searching,    setSearching]    = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef   = useRef<HTMLDivElement>(null);
  const todayStr = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleQueryChange(val: string) {
    setQuery(val);
    setCustomerId(null);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (val.trim().length < 2) { setSuggestions([]); setShowDropdown(false); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res  = await fetch(`/api/customers/search?q=${encodeURIComponent(val.trim())}`);
        const data = await res.json();
        setSuggestions(data.customers ?? []);
        setShowDropdown(true);
      } finally { setSearching(false); }
    }, 300);
  }

  function selectCustomer(c: CustomerSuggestion) {
    setCustomerId(c.id);
    setQuery(c.name);
    setName(c.name);
    setPhone(c.phone ? c.phone.replace(/\D/g, "") : "");
    setSuggestions([]);
    setShowDropdown(false);
  }

  async function send() {
    if (!name.trim() || !phone.trim() || !text.trim()) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/whatsapp/messages", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          customerId:   customerId ?? undefined,
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
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div ref={dropdownRef} className="relative">
            <label className="text-xs font-medium text-muted-foreground">Buscar cliente</label>
            <div className="mt-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input type="text" value={query} onChange={(e) => handleQueryChange(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
                placeholder="Digite o nome ou telefone..."
                className="w-full rounded-md border border-border bg-surface-900 pl-9 pr-8 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              {customerId && !searching && (
                <button onClick={() => { setCustomerId(null); setQuery(""); setName(""); setPhone(""); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {showDropdown && suggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-card shadow-lg overflow-hidden">
                {suggestions.map((c) => (
                  <button key={c.id} onMouseDown={() => selectCustomer(c)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-surface-800 transition-colors text-left">
                    <span className="font-medium text-foreground truncate">{c.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">{c.phone ?? "sem telefone"}</span>
                  </button>
                ))}
              </div>
            )}
            {showDropdown && suggestions.length === 0 && !searching && query.trim().length >= 2 && (
              <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-card shadow-lg px-3 py-2">
                <p className="text-xs text-muted-foreground">Nenhum cliente encontrado.</p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nome</label>
              <input type="text" value={name} onChange={(e) => { setName(e.target.value); setCustomerId(null); }}
                placeholder="João Silva"
                className="mt-1 w-full rounded-md border border-border bg-surface-900 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Telefone (DDD)</label>
              <input type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setCustomerId(null); }}
                placeholder="11999998888"
                className="mt-1 w-full rounded-md border border-border bg-surface-900 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Mensagem</label>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4}
              placeholder="Digite a mensagem..."
              className="mt-1 w-full rounded-md border border-border bg-surface-900 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Agendar para (opcional)</label>
            <input type="date" value={scheduledFor} min={todayStr} onChange={(e) => setScheduledFor(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-surface-900 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
          Mensagens personalizadas só funcionam dentro da janela de 24h de conversa ativa.
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

// ── Edit modal ────────────────────────────────────────────────

function EditMessageModal({ msg, onClose, onSaved }: { msg: WaMessage; onClose: () => void; onSaved: (u: WaMessage) => void }) {
  const [text,         setText]         = useState(msg.message);
  const [scheduledFor, setScheduledFor] = useState(msg.scheduledFor ? msg.scheduledFor.slice(0, 10) : "");
  const [saving,       setSaving]       = useState(false);
  const todayStr = new Date().toISOString().slice(0, 10);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/whatsapp/messages/${msg.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim(), scheduledFor: scheduledFor || null }),
      });
      if (!res.ok) return;
      const data = await res.json();
      onSaved(data.message);
      onClose();
    } finally { setSaving(false); }
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
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        {msg.scheduledFor && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Data de envio</label>
            <input type="date" value={scheduledFor} min={todayStr} onChange={(e) => setScheduledFor(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-900 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        )}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Mensagem</label>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5}
            className="w-full rounded-md border border-border bg-surface-900 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button className="flex-1" onClick={save} disabled={saving || !text.trim()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Salvar
          </Button>
        </div>
      </div>
    </>
  );
}

// ── Message row ───────────────────────────────────────────────

function MessageRow({
  msg, showActions, onSent, onFailed, onDelete, onEdit,
}: {
  msg:         WaMessage;
  showActions?: boolean;
  onSent?:     (id: string) => void;
  onFailed?:   (id: string) => void;
  onDelete?:   (id: string) => void;
  onEdit?:     (updated: WaMessage) => void;
}) {
  const [loading,  setLoading]  = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [localMsg, setLocalMsg] = useState(msg);

  async function send() {
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
    } finally { setLoading(false); }
  }

  async function remove() {
    setLoading(true);
    try {
      await fetch(`/api/whatsapp/messages/${localMsg.id}`, { method: "DELETE" });
      onDelete?.(localMsg.id);
    } finally { setLoading(false); }
  }

  function handleSaved(updated: WaMessage) {
    setLocalMsg(updated);
    onEdit?.(updated);
  }

  const timeStr = localMsg.sentAt
    ? `Enviado ${formatDate(localMsg.sentAt)}`
    : localMsg.scheduledFor
    ? `Agendado ${formatDate(localMsg.scheduledFor)}`
    : formatDate(localMsg.createdAt);

  return (
    <>
      <div className="rounded-lg border border-border bg-surface-800/60 p-2.5 sm:p-3 space-y-1.5 sm:space-y-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-foreground truncate leading-snug">{localMsg.customerName}</span>
            <span className="text-[11px] text-muted-foreground">{localMsg.phone}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {typeIcon(localMsg.type)}
              <span className="hidden sm:inline">{typeLabel(localMsg.type)}</span>
            </span>
            {localMsg.status === "SENT"   && <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />}
            {localMsg.status === "FAILED" && <XCircle      className="h-3.5 w-3.5 text-red-400"   />}
            {localMsg.status === "QUEUED" && <Clock        className="h-3.5 w-3.5 text-yellow-400" />}
          </div>
        </div>

        {/* Message preview */}
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{localMsg.message}</p>

        {/* Failure reason */}
        {localMsg.status === "FAILED" && localMsg.errorMessage && (
          <div className="flex items-start gap-1.5 rounded-md border border-red-500/20 bg-red-500/5 px-2.5 py-1.5">
            <AlertCircle className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-red-400 leading-relaxed break-all">{localMsg.errorMessage}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="text-[10px] text-muted-foreground">{timeStr}</span>
            {localMsg.metaMessageId && (
              <span className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/5 px-1.5 py-0.5 text-[9px] text-green-400">
                <ExternalLink className="h-2.5 w-2.5" />
                <span className="hidden sm:inline">Meta </span>{localMsg.metaMessageId.slice(-8)}
              </span>
            )}
          </div>
          {showActions && localMsg.status === "QUEUED" && (
            <div className="flex gap-1.5 shrink-0">
              <button onClick={send} disabled={loading}
                className="inline-flex items-center gap-1 rounded-md border border-green-500/40 bg-green-500/10 px-2 py-1 text-[11px] text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50">
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                Enviar
              </button>
              <button onClick={() => setShowEdit(true)} disabled={loading}
                className="rounded-md border border-border p-1 text-muted-foreground hover:text-foreground hover:bg-surface-700 transition-colors disabled:opacity-50">
                <Pencil className="h-3 w-3" />
              </button>
              <button onClick={remove} disabled={loading}
                className="rounded-md border border-border p-1 text-muted-foreground hover:text-red-400 hover:border-red-400/40 transition-colors disabled:opacity-50">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>
      {showEdit && <EditMessageModal msg={localMsg} onClose={() => setShowEdit(false)} onSaved={handleSaved} />}
    </>
  );
}

// ── Empty state ───────────────────────────────────────────────

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="rounded-lg border border-border p-8 text-center">
      <div className="flex justify-center mb-2 text-muted-foreground/40">{icon}</div>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

// ── Main client ───────────────────────────────────────────────

export function WhatsappClient({ sentToday, queueMessages, failedToday, historyMessages }: Props) {
  const [tab, setTab] = useState<"sent" | "queue" | "failed" | "history" | "templates">("sent");

  const [sent,    setSent]    = useState(sentToday);
  const [queue,   setQueue]   = useState(queueMessages);
  const [failed,  setFailed]  = useState(failedToday);
  const [history, setHistory] = useState(historyMessages);

  const [processing,    setProcessing]    = useState(false);
  const [processResult, setProcessResult] = useState<{ sent: number; failed: number } | null>(null);
  const [showCompose,   setShowCompose]   = useState(false);

  const TABS = [
    { id: "sent"      as const, label: "Enviadas hoje", icon: CheckCircle2, badge: sent.length,    color: "text-green-400"  },
    { id: "queue"     as const, label: "Na fila",       icon: Clock,        badge: queue.length,   color: "text-yellow-400" },
    { id: "failed"    as const, label: "Com falha",     icon: AlertCircle,  badge: failed.length,  color: "text-red-400"    },
    { id: "history"   as const, label: "Histórico",     icon: History,      badge: history.length, color: "text-muted-foreground" },
    { id: "templates" as const, label: "Templates",     icon: FileText,     badge: null,           color: "text-muted-foreground" },
  ];

  // ── Queue actions ──────────────────────────────────────────

  async function processQueue() {
    setProcessing(true);
    setProcessResult(null);
    try {
      const res  = await fetch("/api/whatsapp/process-queue", { method: "POST" });
      const data = await res.json();
      setProcessResult({ sent: data.sent ?? 0, failed: data.failed ?? 0 });
      setTimeout(() => window.location.reload(), 1500);
    } finally { setProcessing(false); }
  }

  function markSent(id: string) {
    const msg = queue.find((m) => m.id === id);
    setQueue((prev) => prev.filter((m) => m.id !== id));
    if (msg) setSent((prev) => [{ ...msg, status: "SENT", sentAt: new Date().toISOString() }, ...prev]);
  }

  function markFailed(id: string) {
    const msg = queue.find((m) => m.id === id);
    setQueue((prev) => prev.filter((m) => m.id !== id));
    if (msg) setFailed((prev) => [{ ...msg, status: "FAILED" }, ...prev]);
  }

  function removeFromQueue(id: string) {
    setQueue((prev) => prev.filter((m) => m.id !== id));
  }

  function updateMessage(updated: WaMessage) {
    setQueue((prev) => prev.map((m) => m.id === updated.id ? updated : m));
  }

  function handleComposeSent(msg: WaMessage) {
    if (msg.status === "SENT") setSent((prev) => [msg, ...prev]);
    else if (msg.status === "FAILED") setFailed((prev) => [msg, ...prev]);
    else setQueue((prev) => [msg, ...prev]);
  }

  // ── History grouped by day ─────────────────────────────────

  const historyByDay = history.reduce<{ day: string; msgs: WaMessage[] }[]>((acc, m) => {
    const day = m.sentAt ? formatDay(m.sentAt) : formatDay(m.createdAt);
    const group = acc.find((g) => g.day === day);
    if (group) group.msgs.push(m);
    else acc.push({ day, msgs: [m] });
    return acc;
  }, []);

  return (
    <div className="flex-1 px-3 py-3 sm:px-6 sm:py-5 space-y-3 overflow-y-auto">

      {/* Tab bar + compose button */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 sm:px-3 sm:py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "border-gold-500/40 bg-gold-500/10 text-gold-400"
                : "border-border text-muted-foreground hover:border-gold-500/20 hover:text-foreground"
            }`}
          >
            <t.icon className={`h-3.5 w-3.5 shrink-0 ${tab === t.id ? "text-gold-400" : t.color}`} />
            <span className="hidden sm:inline">{t.label}</span>
            {t.badge !== null && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                tab === t.id ? "bg-gold-500/20 text-gold-400" : "bg-surface-700 text-muted-foreground"
              }`}>{t.badge}</span>
            )}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => setShowCompose(true)}
          className="shrink-0 flex items-center gap-1.5 rounded-lg border border-gold-500/40 bg-gold-500/10 px-2.5 py-1.5 sm:px-3 sm:py-2 text-sm font-medium text-gold-400 hover:bg-gold-500/20 transition-colors"
        >
          <PenLine className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline">Mensagem personalizada</span>
        </button>
      </div>

      {showCompose && <ComposeModal onClose={() => setShowCompose(false)} onSent={handleComposeSent} />}

      {/* ── Enviadas hoje ──────────────────────────────────── */}
      {tab === "sent" && (
        <div className="space-y-2">
          {sent.length === 0
            ? <Empty icon={<CheckCircle2 className="h-8 w-8" />} text="Nenhuma mensagem enviada hoje." />
            : sent.map((m) => <MessageRow key={m.id} msg={m} />)
          }
        </div>
      )}

      {/* ── Na fila ───────────────────────────────────────── */}
      {tab === "queue" && (
        <div className="space-y-2">
          {queue.length === 0 ? (
            <Empty icon={<Clock className="h-8 w-8" />} text="Fila vazia — tudo enviado!" />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {queue.length} mensage{queue.length !== 1 ? "ns" : "m"} aguardando.
                </p>
                <button
                  onClick={processQueue}
                  disabled={processing}
                  className="inline-flex items-center gap-1.5 rounded-md bg-gold-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-gold-400 transition-colors disabled:opacity-50"
                >
                  {processing
                    ? <><Loader2 className="h-3 w-3 animate-spin" />Processando...</>
                    : <><Send className="h-3 w-3" />Enviar tudo</>}
                </button>
              </div>
              {processResult && (
                <div className={`rounded-md border px-3 py-2 text-xs ${
                  processResult.failed > 0 ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-green-500/30 bg-green-500/10 text-green-400"
                }`}>
                  {processResult.sent} enviada{processResult.sent !== 1 ? "s" : ""}
                  {processResult.failed > 0 && `, ${processResult.failed} com falha`}
                  {" — atualizando..."}
                </div>
              )}
              {queue.map((m) => (
                <MessageRow key={m.id} msg={m} showActions
                  onSent={markSent} onFailed={markFailed} onDelete={removeFromQueue} onEdit={updateMessage} />
              ))}
            </>
          )}
        </div>
      )}

      {/* ── Com falha ─────────────────────────────────────── */}
      {tab === "failed" && (
        <div className="space-y-2">
          {failed.length === 0
            ? <Empty icon={<XCircle className="h-8 w-8" />} text="Nenhuma falha hoje. Ótimo!" />
            : failed.map((m) => (
                <MessageRow key={m.id} msg={m} showActions
                  onSent={markSent} onFailed={markFailed} onDelete={removeFromQueue} onEdit={updateMessage} />
              ))
          }
        </div>
      )}

      {/* ── Histórico ─────────────────────────────────────── */}
      {tab === "history" && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">Mensagens enviadas nos últimos 10 dias. Registros são apagados automaticamente após esse período.</p>
          {historyByDay.length === 0
            ? <Empty icon={<History className="h-8 w-8" />} text="Nenhuma mensagem no histórico." />
            : historyByDay.map((group) => (
                <div key={group.day} className="space-y-2">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide capitalize">{group.day}</p>
                  {group.msgs.map((m) => <MessageRow key={m.id} msg={m} />)}
                </div>
              ))
          }
        </div>
      )}

      {/* ── Templates ─────────────────────────────────────── */}
      {tab === "templates" && <TemplatesTab />}
    </div>
  );
}
