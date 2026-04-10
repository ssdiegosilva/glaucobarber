"use client";

import { useState, useRef, useEffect } from "react";
import { isAiLimitError, triggerAiLimitModal } from "@/lib/ai-error";
import { Button } from "@/components/ui/button";
import {
  MessageCircle, Clock, CheckCircle2, XCircle, Send,
  Trash2, RotateCcw, Users, CalendarDays, Star, RefreshCcw,
  Loader2, Pencil, X, PenLine, Search, FileText,
  ExternalLink, AlertCircle, Sparkles, LayoutTemplate, Bot,
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
  sentManually:  boolean;
  messageKind:   string;
  scheduledFor:  string | null;
  createdAt:     string;
  metaMessageId: string | null | undefined;
  errorMessage:  string | null | undefined;
};

interface Props {
  sentToday:          WaMessage[];
  queueMessages:      WaMessage[];
  failedToday:        WaMessage[];
  historyMessages:    WaMessage[];
  hasAutoSend:        boolean;
  whatsappConfigured: boolean;
  hasTemplates:       boolean;
  hasWabaId:          boolean;
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
type TextTemplate = { id: string; label: string; body: string; active: boolean };

function ComposeModal({ onClose, onSent }: { onClose: () => void; onSent: (msg: WaMessage) => void }) {
  const [customerId,   setCustomerId]   = useState<string | null>(null);
  const [name,         setName]         = useState("");
  const [phone,        setPhone]        = useState("");
  const [text,         setText]         = useState("");
  const [sending,      setSending]      = useState(false);
  const [error,        setError]        = useState("");
  const [query,        setQuery]        = useState("");
  const [suggestions,  setSuggestions]  = useState<CustomerSuggestion[]>([]);
  const [searching,    setSearching]    = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Template mode
  const [mode,           setMode]           = useState<"write" | "template">("write");
  const [textTemplates,  setTextTemplates]  = useState<TextTemplate[]>([]);
  const [loadingTpls,    setLoadingTpls]    = useState(false);
  const [tplsLoaded,     setTplsLoaded]     = useState(false);
  const [personalizing,  setPersonalizing]  = useState<string | null>(null); // template id being personalized

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function switchToTemplateMode() {
    setMode("template");
    if (tplsLoaded) return;
    setLoadingTpls(true);
    try {
      const res  = await fetch("/api/whatsapp/templates?kind=text");
      const data = await res.json();
      setTextTemplates((Array.isArray(data) ? data : []).filter((t: TextTemplate & { active: boolean }) => t.active));
      setTplsLoaded(true);
    } finally {
      setLoadingTpls(false);
    }
  }

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

  function substituteTemplateName(body: string, clientName: string): string {
    return body
      .replace(/\{\{name\}\}/gi,    clientName)
      .replace(/\{\{cliente\}\}/gi, clientName)
      .replace(/\{\{1\}\}/g,        clientName);
  }

  async function applyTemplate(tpl: TextTemplate) {
    const clientName = name.trim();
    if (clientName) {
      // Substituição imediata primeiro
      const substituted = substituteTemplateName(tpl.body, clientName);
      setText(substituted);
      setMode("write");
      // Tenta enriquecer via IA em background
      setPersonalizing(tpl.id);
      try {
        const res = await fetch("/api/whatsapp/messages/personalize", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ templateBody: tpl.body, customerName: clientName }),
        });
        const data = await res.json();
        if (isAiLimitError(res.status, data)) { triggerAiLimitModal(); return; }
        if (res.ok && data.message) setText(data.message);
      } catch {
        // já temos a substituição simples, não faz nada
      } finally {
        setPersonalizing(null);
      }
    } else {
      setText(tpl.body);
      setMode("write");
    }
  }

  async function send() {
    if (!name.trim() || !phone.trim() || !text.trim()) return;
    setSending(true);
    setError("");
    try {
      // Abre WhatsApp com a mensagem pré-preenchida
      const clean   = phone.trim().replace(/\D/g, "");
      const waPhone = clean.startsWith("55") ? clean : `55${clean}`;
      window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(text.trim())}`, "_blank");

      // Registra como enviado manualmente no sistema
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
          sentManually: true,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      onSent(data.message);
      onClose();
    } catch {
      setError("Erro ao registrar mensagem.");
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
          {/* Customer search */}
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

          {/* Name + phone */}
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

          {/* Write / Template toggle */}
          <div className="flex gap-1.5 rounded-lg border border-border p-1 bg-surface-900">
            <button onClick={() => setMode("write")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${
                mode === "write" ? "bg-surface-700 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}>
              <PenLine className="h-3.5 w-3.5" /> Escrever
            </button>
            <button onClick={switchToTemplateMode}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${
                mode === "template" ? "bg-surface-700 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}>
              <LayoutTemplate className="h-3.5 w-3.5" /> Usar template
            </button>
          </div>

          {/* Write mode: textarea */}
          {mode === "write" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Mensagem</label>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4}
                placeholder="Digite a mensagem..."
                className="mt-1 w-full rounded-md border border-border bg-surface-900 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
            </div>
          )}

          {/* Template mode: picker */}
          {mode === "template" && (
            <div className="space-y-2">
              {!name.trim() && (
                <div className="flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs text-blue-400">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>Selecione um cliente acima para a IA personalizar a mensagem com o nome dele automaticamente.</span>
                </div>
              )}
              {loadingTpls ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : textTemplates.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/60 p-6 text-center">
                  <p className="text-xs text-muted-foreground">Nenhum template de texto ativo.</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-1">Crie templates na aba Templates → Criar um template.</p>
                </div>
              ) : (
                <div className="divide-y divide-border rounded-lg border border-border overflow-hidden max-h-56 overflow-y-auto">
                  {textTemplates.map((tpl) => (
                    <div key={tpl.id} className="flex items-start gap-3 px-3 py-2.5 hover:bg-surface-800 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground">{tpl.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{tpl.body}</p>
                      </div>
                      <button
                        onClick={() => applyTemplate(tpl)}
                        disabled={personalizing === tpl.id}
                        className="shrink-0 flex items-center gap-1 rounded-md border border-gold-500/40 bg-gold-500/10 px-2 py-1 text-[11px] text-gold-400 hover:bg-gold-500/20 transition-colors disabled:opacity-50"
                      >
                        {personalizing === tpl.id
                          ? <><Loader2 className="h-3 w-3 animate-spin" />IA...</>
                          : name.trim()
                          ? <><Sparkles className="h-3 w-3" />Usar</>
                          : "Usar"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={sending}>Cancelar</Button>
          <Button className="flex-1 gap-2" onClick={send} disabled={sending || !name || !phone || !text}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar agora
          </Button>
        </div>
      </div>
    </>
  );
}

// ── BotMessageModal ───────────────────────────────────────────

type TargetCustomer = { id: string; name: string; phone: string | null; lastAppointmentAt: string | null; lastWhatsappSentAt: string | null };
type ActiveTemplate  = { id: string; metaName: string; label: string; body: string; variables: string };

const FILTER_OPTIONS = [
  { key: "post_sale",    label: "Recém-atendidos", desc: "Atendidos recentemente" },
  { key: "em_risco",     label: "Em risco",        desc: "Podem ficar inativos" },
  { key: "inactive",     label: "Inativos",        desc: "Sem visita há mais de 60 dias" },
  { key: "reactivated",  label: "Reativados",      desc: "Voltaram recentemente" },
  { key: "all",          label: "Todos",           desc: "Com telefone cadastrado" },
] as const;

function BotMessageModal({ onClose, onScheduled, hasTemplates }: { onClose: () => void; onScheduled: (count: number) => void; hasTemplates: boolean }) {
  const [step,            setStep]            = useState<1 | 2 | 3>(1);
  const [filter,          setFilter]          = useState<string>("post_sale");
  const [customers,       setCustomers]       = useState<TargetCustomer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [selectedIds,     setSelectedIds]     = useState<Set<string>>(new Set());
  const [templates,       setTemplates]       = useState<ActiveTemplate[]>([]);
  const [selectedTpl,     setSelectedTpl]     = useState<ActiveTemplate | null>(null);
  const [tplVars,         setTplVars]         = useState<string[]>([]);
  const [scheduledFor,    setScheduledFor]    = useState("");
  const [scheduling,      setScheduling]      = useState(false);
  const [error,           setError]           = useState("");

  const todayStr = new Date().toISOString().slice(0, 16);

  // Carrega clientes ao mudar filtro
  useEffect(() => {
    setLoadingCustomers(true);
    setSelectedIds(new Set());
    setError("");
    fetch(`/api/whatsapp/message-targets?filter=${filter}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setCustomers(d.customers ?? []);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoadingCustomers(false));
  }, [filter]);

  // Carrega templates na primeira vez
  useEffect(() => {
    fetch("/api/whatsapp/templates")
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d) ? d : [];
        setTemplates(list.filter((t: ActiveTemplate & { active: boolean }) => t.active));
      });
  }, []);

  function toggleCustomer(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(customers.map((c) => c.id)));
  }

  function clearAll() { setSelectedIds(new Set()); }

  function selectTemplate(tpl: ActiveTemplate) {
    setSelectedTpl(tpl);
    const vars: { key: string; label: string; defaultValue: string }[] = JSON.parse(tpl.variables || "[]");
    setTplVars(vars.map((v) => v.defaultValue || ""));
  }

  async function schedule() {
    if (!selectedTpl || selectedIds.size === 0) return;
    setScheduling(true);
    setError("");
    try {
      const res = await fetch("/api/whatsapp/messages/batch", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerIds:    Array.from(selectedIds),
          templateName:   selectedTpl.metaName,
          templateVars:   tplVars,
          scheduledFor:   scheduledFor || null,
          messagePreview: selectedTpl.body,
        }),
      });
      if (!res.ok) throw new Error("Erro ao agendar");
      const data = await res.json();
      onScheduled(data.created ?? 0);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao agendar mensagens");
    } finally {
      setScheduling(false);
    }
  }

  const parsedVars: { key: string; label: string }[] = selectedTpl
    ? JSON.parse(selectedTpl.variables || "[]")
    : [];

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-50" onClick={onClose} />
      <div className="fixed inset-x-3 top-1/2 -translate-y-1/2 z-[60] rounded-xl border border-border bg-card shadow-2xl max-h-[88vh] flex flex-col max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Enviar com bot</h3>
            <p className="text-[11px] text-muted-foreground">
              {step === 1 ? "1. Selecione os clientes pelo filtro" : step === 2 ? "2. Escolha o template e agende" : "3. Confirme o envio"}
            </p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        {/* Aviso se sem templates */}
        {!hasTemplates && (
          <div className="mx-4 mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-300">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              Nenhum template configurado. Vá em{" "}
              <a href="/settings" className="underline font-medium">Integrações → Templates</a>
              {" "}para adicionar o WABA ID e sincronizar seus templates aprovados na Meta.
            </span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {/* ── Etapa 1: filtro + lista ── */}
          {step === 1 && (
            <div className="p-4 space-y-3">
              {/* filtros */}
              <div className="flex flex-wrap gap-2">
                {FILTER_OPTIONS.map((f) => (
                  <button key={f.key} onClick={() => setFilter(f.key)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      filter === f.key
                        ? "border-gold-500/40 bg-gold-500/10 text-gold-400"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}>
                    {f.label}
                  </button>
                ))}
              </div>

              {error && (
                <p className="text-xs text-red-400 py-2">{error}</p>
              )}
              {loadingCustomers ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : customers.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Nenhum cliente encontrado para esse filtro.</p>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{customers.length} cliente{customers.length !== 1 ? "s" : ""} · {selectedIds.size} selecionado{selectedIds.size !== 1 ? "s" : ""}</span>
                    <div className="flex gap-2">
                      <button onClick={selectAll}  className="text-gold-400 hover:underline">Todos</button>
                      <button onClick={clearAll}   className="hover:underline">Limpar</button>
                    </div>
                  </div>
                  <div className="divide-y divide-border rounded-lg border border-border overflow-hidden max-h-60 overflow-y-auto">
                    {customers.map((c) => (
                      <label key={c.id} className="flex items-center gap-3 px-3 py-2 hover:bg-surface-800 cursor-pointer">
                        <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleCustomer(c.id)}
                          className="rounded border-border accent-gold-500" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{c.name}</p>
                          <p className="text-[10px] text-muted-foreground">{c.phone}</p>
                        </div>
                        {c.lastAppointmentAt && (
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {Math.floor((Date.now() - new Date(c.lastAppointmentAt).getTime()) / 86400000)}d atrás
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Etapa 2: template + data ── */}
          {step === 2 && (
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Template</label>
                {templates.length === 0 ? (
                  <p className="text-xs text-amber-400">Nenhum template ativo. Configure na aba Templates.</p>
                ) : (
                  <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                    {templates.map((tpl) => (
                      <button key={tpl.id} onClick={() => selectTemplate(tpl)}
                        className={`w-full text-left px-3 py-2.5 transition-colors ${
                          selectedTpl?.id === tpl.id ? "bg-gold-500/10 border-l-2 border-gold-500" : "hover:bg-surface-800"
                        }`}>
                        <p className="text-xs font-medium text-foreground">{tpl.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{tpl.body}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedTpl && parsedVars.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Variáveis do template</label>
                  {parsedVars.map((v, i) => (
                    <div key={v.key}>
                      <label className="text-[10px] text-muted-foreground">{v.label} ({v.key})</label>
                      <div className="flex gap-2 mt-0.5">
                        <input value={tplVars[i] ?? ""} onChange={(e) => {
                          const next = [...tplVars]; next[i] = e.target.value; setTplVars(next);
                        }} placeholder={`Valor para ${v.key} — use {{name}} para nome do cliente`}
                          className="flex-1 rounded-md border border-border bg-surface-900 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                      </div>
                    </div>
                  ))}
                  <p className="text-[10px] text-muted-foreground/60">Use <code className="bg-surface-800 px-1 rounded">&#123;&#123;name&#125;&#125;</code> para inserir o nome de cada cliente automaticamente.</p>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Agendar para <span className="text-muted-foreground/60">(deixe vazio para na próxima run do bot)</span>
                </label>
                <input type="datetime-local" value={scheduledFor} min={todayStr}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface-900 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>
          )}

          {/* ── Etapa 3: confirmação ── */}
          {step === 3 && selectedTpl && (
            <div className="p-4 space-y-4">
              <div className="rounded-lg border border-gold-500/20 bg-gold-500/5 p-4 space-y-2">
                <p className="text-xs font-semibold text-foreground">Resumo do agendamento</p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p><span className="text-foreground font-medium">{selectedIds.size}</span> mensagem{selectedIds.size !== 1 ? "s" : ""} serão agendadas</p>
                  <p>Template: <span className="text-foreground font-medium">{selectedTpl.label}</span></p>
                  <p>Envio: <span className="text-foreground font-medium">{scheduledFor ? new Date(scheduledFor).toLocaleString("pt-BR") : "Próxima run do bot (≤ 15 min)"}</span></p>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-surface-800/60 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Preview do template</p>
                <p className="text-xs text-foreground leading-relaxed">{selectedTpl.body}</p>
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>
          )}
        </div>

        {/* Footer com botões de navegação */}
        <div className="flex gap-2 px-5 py-4 border-t border-border shrink-0">
          {step > 1 && (
            <button onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
              className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
              Voltar
            </button>
          )}
          <div className="flex-1" />
          {step === 1 && (
            <button onClick={() => setStep(2)} disabled={selectedIds.size === 0 || !hasTemplates}
              className="rounded-lg bg-gold-500 px-4 py-2 text-xs font-semibold text-[#080810] hover:bg-gold-400 transition-colors disabled:opacity-40"
              title={!hasTemplates ? "Configure templates antes de continuar" : undefined}>
              Próximo · {selectedIds.size} selecionado{selectedIds.size !== 1 ? "s" : ""}
            </button>
          )}
          {step === 2 && (
            <button onClick={() => setStep(3)} disabled={!selectedTpl}
              className="rounded-lg bg-gold-500 px-4 py-2 text-xs font-semibold text-[#080810] hover:bg-gold-400 transition-colors disabled:opacity-40">
              Revisar
            </button>
          )}
          {step === 3 && (
            <button onClick={schedule} disabled={scheduling}
              className="rounded-lg bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-500 transition-colors disabled:opacity-50">
              {scheduling ? <><Loader2 className="h-3 w-3 animate-spin inline mr-1" />Agendando...</> : "Confirmar e agendar"}
            </button>
          )}
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
  msg, showActions, isToday, hasAutoSend, whatsappConfigured,
  onManualSent, onFailed, onDelete, onEdit, onRetry,
}: {
  msg:                WaMessage;
  showActions?:       boolean;
  isToday?:           boolean;
  hasAutoSend?:       boolean;
  whatsappConfigured?: boolean;
  onManualSent?:      (id: string) => void;
  onFailed?:          (id: string) => void;
  onDelete?:          (id: string) => void;
  onEdit?:            (updated: WaMessage) => void;
  onRetry?:           (id: string) => void;
}) {
  const [loading,    setLoading]    = useState(false);
  const [showEdit,   setShowEdit]   = useState(false);
  const [localMsg,   setLocalMsg]   = useState(msg);
  const [botLoading, setBotLoading] = useState(false);
  const [swipeX,     setSwipeX]     = useState(0);
  const [isSwiping,  setIsSwiping]  = useState(false);
  const touchStartX = useRef<number | null>(null);
  const SWIPE_THRESHOLD = 80;

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    setIsSwiping(true);
  }
  function onTouchMove(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const delta = e.touches[0].clientX - touchStartX.current;
    if (delta > 0) setSwipeX(Math.min(delta, 130));
  }
  function onTouchEnd() {
    setIsSwiping(false);
    touchStartX.current = null;
    if (swipeX >= SWIPE_THRESHOLD) {
      setSwipeX(400);
      remove();
    } else {
      setSwipeX(0);
    }
  }

  /** Abre o WhatsApp do usuário e marca como enviado manualmente */
  async function sendManual() {
    const phone = localMsg.phone.replace(/\D/g, "");
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(localMsg.message)}`, "_blank");
    setLoading(true);
    try {
      await fetch(`/api/whatsapp/messages/${localMsg.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "SENT", sentManually: true }),
      });
      onManualSent?.(localMsg.id);
    } finally { setLoading(false); }
  }

  /** Aciona o bot para enviar agora (processa a fila) */
  async function sendViaBot() {
    setBotLoading(true);
    try {
      await fetch("/api/whatsapp/process-queue", { method: "POST" });
      setTimeout(() => window.location.reload(), 800);
    } finally { setBotLoading(false); }
  }

  async function remove() {
    setLoading(true);
    try {
      await fetch(`/api/whatsapp/messages/${localMsg.id}`, { method: "DELETE" });
      onDelete?.(localMsg.id);
    } finally { setLoading(false); }
  }

  async function retry() {
    setLoading(true);
    try {
      const scheduledFor = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // +1h
      const res = await fetch(`/api/whatsapp/messages/${localMsg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "QUEUED", scheduledFor }),
      });
      if (res.ok) onRetry?.(localMsg.id);
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
      {/* swipe wrapper */}
      <div className="relative overflow-hidden rounded-lg">
        {/* delete background revealed on swipe */}
        {swipeX > 0 && (
          <div
            className="absolute inset-y-0 left-0 flex items-center pl-4 rounded-lg bg-red-500/20 border border-red-500/30"
            style={{ width: `${swipeX}px`, transition: isSwiping ? "none" : "width 0.2s ease" }}
          >
            <Trash2 className={`h-4 w-4 text-red-400 transition-opacity ${swipeX >= SWIPE_THRESHOLD ? "opacity-100" : "opacity-50"}`} />
          </div>
        )}
        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{
            transform: `translateX(${swipeX}px)`,
            transition: isSwiping ? "none" : "transform 0.25s ease",
          }}
          className={`rounded-lg border p-2.5 sm:p-3 space-y-1.5 sm:space-y-2 ${
            isToday
              ? "border-amber-500/40 bg-amber-500/5 ring-1 ring-amber-500/20"
              : "border-border bg-surface-800/60"
          }`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-foreground truncate leading-snug">{localMsg.customerName}</span>
            <span className="text-[11px] text-muted-foreground">{localMsg.phone}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isToday && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
                <Clock className="h-2.5 w-2.5" />
                Hoje
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {typeIcon(localMsg.type)}
              <span className="hidden sm:inline">{typeLabel(localMsg.type)}</span>
            </span>
            {localMsg.status === "SENT"   && <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />}
            {localMsg.status === "FAILED" && <XCircle      className="h-3.5 w-3.5 text-red-400"   />}
            {localMsg.status === "QUEUED" && !isToday && <Clock className="h-3.5 w-3.5 text-yellow-400" />}
          </div>
        </div>

        {/* Message preview */}
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{localMsg.message}</p>

        {/* Failure reason */}
        {localMsg.status === "FAILED" && (
          <div className="flex items-start gap-1.5 rounded-md border border-red-500/20 bg-red-500/5 px-2.5 py-1.5">
            <AlertCircle className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-red-400 leading-relaxed break-all">
              {localMsg.errorMessage ?? "Sem detalhes disponíveis"}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="text-[10px] text-muted-foreground">{timeStr}</span>
            {/* manual / auto tag — shown for queued and sent */}
            {localMsg.messageKind !== "template" ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/5 px-1.5 py-0.5 text-[9px] text-amber-400">👤 manual</span>
            ) : localMsg.status === "QUEUED" && hasAutoSend && whatsappConfigured ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[9px] text-blue-400">🤖 bot envia automaticamente</span>
            ) : localMsg.status === "SENT" && !localMsg.sentManually ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/5 px-1.5 py-0.5 text-[9px] text-green-400">🤖 automático</span>
            ) : localMsg.status === "SENT" && localMsg.sentManually ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/5 px-1.5 py-0.5 text-[9px] text-amber-400">👤 manual</span>
            ) : null}
            {localMsg.metaMessageId && (
              <span className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/5 px-1.5 py-0.5 text-[9px] text-green-400">
                <ExternalLink className="h-2.5 w-2.5" />
                <span className="hidden sm:inline">Meta </span>{localMsg.metaMessageId.slice(-8)}
              </span>
            )}
          </div>

          {/* SENT: only delete */}
          {localMsg.status === "SENT" && (
            <button onClick={remove} disabled={loading}
              className="rounded-md border border-border p-1 text-muted-foreground hover:text-red-400 hover:border-red-400/40 transition-colors disabled:opacity-50">
              <Trash2 className="h-3 w-3" />
            </button>
          )}

          {/* QUEUED actions */}
          {showActions && localMsg.status === "QUEUED" && (
            <div className="flex gap-1.5 shrink-0 flex-wrap">
              {hasAutoSend && whatsappConfigured && localMsg.messageKind === "template" ? (
                /* PRO + template: dois botões */
                <>
                  <button onClick={sendManual} disabled={loading || botLoading}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-surface-700 transition-colors disabled:opacity-50">
                    {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    Enviar manual
                  </button>
                  <button onClick={sendViaBot} disabled={loading || botLoading}
                    className="inline-flex items-center gap-1 rounded-md border border-green-500/40 bg-green-500/10 px-2 py-1 text-[11px] text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50">
                    {botLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    Via bot agora
                  </button>
                </>
              ) : (
                /* Texto livre ou sem auto-send: sempre manual, botão pulsando */
                <button onClick={sendManual} disabled={loading}
                  className="inline-flex items-center gap-1 rounded-md border border-green-500/40 bg-green-500/10 px-2 py-1 text-[11px] text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50 animate-pulse">
                  {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  Enviar no WhatsApp
                </button>
              )}
              <button onClick={() => setShowEdit(true)} disabled={loading || botLoading}
                className="rounded-md border border-border p-1 text-muted-foreground hover:text-foreground hover:bg-surface-700 transition-colors disabled:opacity-50">
                <Pencil className="h-3 w-3" />
              </button>
              <button onClick={remove} disabled={loading || botLoading}
                className="rounded-md border border-border p-1 text-muted-foreground hover:text-red-400 hover:border-red-400/40 transition-colors disabled:opacity-50">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* FAILED actions */}
          {showActions && localMsg.status === "FAILED" && (
            <div className="flex gap-1.5 shrink-0">
              <button onClick={retry} disabled={loading}
                className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50">
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                Tentar novamente
              </button>
              <button onClick={remove} disabled={loading}
                className="rounded-md border border-border p-1 text-muted-foreground hover:text-red-400 hover:border-red-400/40 transition-colors disabled:opacity-50">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
        </div>{/* end swipeable row */}
      </div>{/* end swipe wrapper */}
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

export function WhatsappClient({ sentToday, queueMessages, failedToday, historyMessages, hasAutoSend, whatsappConfigured, hasTemplates, hasWabaId }: Props) {
  const [tab, setTab] = useState<"sent" | "queue" | "failed" | "templates">("sent");

  const [sent,    setSent]    = useState(sentToday);
  const [queue,   setQueue]   = useState(queueMessages);
  const [failed,  setFailed]  = useState(failedToday);
  const [history, setHistory] = useState(historyMessages);

  const [processing,    setProcessing]    = useState(false);
  const [processResult, setProcessResult] = useState<{ sent: number; failed: number } | null>(null);
  const [showCompose,   setShowCompose]   = useState(false);
  const [showBotModal,  setShowBotModal]  = useState(false);
  const [syncingTpls,   setSyncingTpls]  = useState(false);

  async function syncTemplates() {
    setSyncingTpls(true);
    try {
      await fetch("/api/whatsapp/templates/sync", { method: "POST" });
      setTab("templates");
      window.location.reload();
    } finally {
      setSyncingTpls(false);
    }
  }

  const TABS = [
    { id: "sent"      as const, label: "Enviadas",  icon: CheckCircle2, badge: sent.length + history.length, color: "text-green-400",          active: "border-green-500/40 bg-green-500/10 text-green-400",   activeBadge: "bg-green-500/20 text-green-400",   activeIcon: "text-green-400"   },
    { id: "queue"     as const, label: "Na fila",   icon: Clock,        badge: queue.length,                 color: "text-yellow-400",         active: "border-yellow-500/40 bg-yellow-500/10 text-yellow-400", activeBadge: "bg-yellow-500/20 text-yellow-400", activeIcon: "text-yellow-400"  },
    { id: "failed"    as const, label: "Com falha", icon: AlertCircle,  badge: failed.length,                color: "text-red-400",            active: "border-red-500/40 bg-red-500/10 text-red-400",          activeBadge: "bg-red-500/20 text-red-400",       activeIcon: "text-red-400"     },
    { id: "templates" as const, label: "Templates", icon: FileText,     badge: null,                         color: "text-muted-foreground",   active: "border-purple-500/40 bg-purple-500/10 text-purple-400", activeBadge: "bg-purple-500/20 text-purple-400", activeIcon: "text-purple-400"  },
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

  function markManualSent(id: string) {
    const msg = queue.find((m) => m.id === id);
    setQueue((prev) => prev.filter((m) => m.id !== id));
    if (msg) setSent((prev) => [{ ...msg, status: "SENT", sentManually: true, sentAt: new Date().toISOString() }, ...prev]);
  }

  function markFailed(id: string) {
    const msg = queue.find((m) => m.id === id);
    setQueue((prev) => prev.filter((m) => m.id !== id));
    if (msg) setFailed((prev) => [{ ...msg, status: "FAILED" }, ...prev]);
  }

  function removeFromQueue(id: string) {
    setQueue((prev) => prev.filter((m) => m.id !== id));
  }

  function retryMessage(id: string) {
    const msg = failed.find((m) => m.id === id);
    setFailed((prev) => prev.filter((m) => m.id !== id));
    if (msg) {
      const scheduledFor = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      setQueue((prev) => [{ ...msg, status: "QUEUED", scheduledFor }, ...prev]);
    }
  }

  function removeFromFailed(id: string) {
    setFailed((prev) => prev.filter((m) => m.id !== id));
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

  const botActive = hasAutoSend && whatsappConfigured && hasWabaId;

  return (
    <div className="px-3 py-3 sm:px-6 sm:py-5 space-y-3">

      {/* ── Banner de status do envio automático ─────────────── */}
      {hasAutoSend && !whatsappConfigured ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>WhatsApp não configurado para envio automático — configure nas <a href="/settings" className="underline font-medium">Integrações</a> para ativar.</span>
        </div>
      ) : !hasAutoSend ? (
        <div className="flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-xs text-blue-300">
          <Send className="h-3.5 w-3.5 shrink-0" />
          <span>Envio automático disponível no plano PRO — <a href="/billing" className="underline font-medium">ver planos</a>. Você pode enviar manualmente clicando nas mensagens da fila.</span>
        </div>
      ) : !hasTemplates ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>
            Nenhum template configurado — o bot precisa de templates aprovados na Meta para enviar.{" "}
            {hasWabaId
              ? <button onClick={syncTemplates} disabled={syncingTpls} className="underline font-medium">{syncingTpls ? "Sincronizando..." : "Sincronizar da Meta"}</button>
              : <><a href="/settings" className="underline font-medium">Adicione o WABA ID</a> nas Integrações para sincronizar.</>
            }
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/5 px-3 py-2 text-xs text-green-300">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          <span>Bot ativo — processa a fila a cada 15 min 🤖. Você também pode enviar manualmente quando quiser.</span>
        </div>
      )}

      {/* Tab bar + compose button */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 sm:px-3 sm:py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? t.active
                : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground"
            }`}
          >
            <t.icon className={`h-3.5 w-3.5 shrink-0 ${tab === t.id ? t.activeIcon : t.color}`} />
            <span className="hidden sm:inline">{t.label}</span>
            {t.badge !== null && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                tab === t.id ? t.activeBadge : "bg-surface-700 text-muted-foreground"
              }`}>{t.badge}</span>
            )}
          </button>
        ))}
        <div className="flex-1" />
        {botActive && (
          <button
            onClick={() => setShowBotModal(true)}
            className="shrink-0 flex items-center gap-1.5 rounded-lg border border-purple-500/40 bg-purple-500/10 px-2.5 py-1.5 sm:px-3 sm:py-2 text-sm font-medium text-purple-400 hover:bg-purple-500/20 transition-colors"
          >
            <Bot className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Enviar com bot</span>
          </button>
        )}
        <button
          onClick={() => setShowCompose(true)}
          className="shrink-0 flex items-center gap-1.5 rounded-lg border border-gold-500/40 bg-gold-500/10 px-2.5 py-1.5 sm:px-3 sm:py-2 text-sm font-medium text-gold-400 hover:bg-gold-500/20 transition-colors"
        >
          <PenLine className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline">Enviar personalizado e manual</span>
        </button>
      </div>

      {showCompose && <ComposeModal onClose={() => setShowCompose(false)} onSent={handleComposeSent} />}
      {showBotModal && (
        <BotMessageModal
          onClose={() => setShowBotModal(false)}
          onScheduled={() => { setShowBotModal(false); setTab("queue"); window.location.reload(); }}
          hasTemplates={hasTemplates}
        />
      )}

      {/* Tab description */}
      {tab === "sent"    && <p className="text-xs text-muted-foreground border-b border-border/40 pb-2">Mensagens enviadas com sucesso. Histórico dos últimos 5 dias.</p>}
      {tab === "queue" && (
        <p className="text-xs text-muted-foreground border-b border-border/40 pb-2">
          {botActive
            ? "Mensagens marcadas com 🤖 serão enviadas automaticamente pelo bot — você não precisa abrir o WhatsApp. O bot processa a fila a cada 15 min. Mensagens 👤 precisam de envio manual."
            : "Todas as mensagens precisam de envio manual — clique em cada uma para abrir o WhatsApp."}
        </p>
      )}
      {tab === "failed"  && <p className="text-xs text-muted-foreground border-b border-border/40 pb-2">Mensagens que falharam no envio. Use &quot;Tentar novamente&quot; para reagendar para daqui 1 hora. Itens com mais de 1 dia são removidos automaticamente.</p>}

      {/* ── Enviadas (hoje + histórico) ────────────────────── */}
      {tab === "sent" && (
        <div className="space-y-4">
          {sent.length === 0 && history.length === 0 ? (
            <Empty icon={<CheckCircle2 className="h-8 w-8" />} text="Nenhuma mensagem enviada ainda." />
          ) : (
            <>
              {/* Hoje */}
              {sent.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-400">
                      <Clock className="h-3 w-3" />
                      Hoje · {sent.length} mensagem{sent.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {sent.map((m) => <MessageRow key={m.id} msg={m} isToday onDelete={(id) => setSent((p) => p.filter((x) => x.id !== id))} />)}
                </div>
              )}

              {/* Dias anteriores agrupados */}
              {historyByDay.map((group) => (
                <div key={group.day} className="space-y-2">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide capitalize">{group.day}</p>
                  {group.msgs.map((m) => <MessageRow key={m.id} msg={m} onDelete={(id) => setHistory((p) => p.filter((x) => x.id !== id))} />)}
                </div>
              ))}
            </>
          )}
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
                {botActive && queue.some((m) => m.messageKind === "template") && (
                  <button
                    onClick={processQueue}
                    disabled={processing}
                    className="inline-flex items-center gap-1.5 rounded-md bg-gold-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-gold-400 transition-colors disabled:opacity-50"
                  >
                    {processing
                      ? <><Loader2 className="h-3 w-3 animate-spin" />Processando...</>
                      : <><Send className="h-3 w-3" />Enviar tudo via bot</>}
                  </button>
                )}
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
              {(() => {
                const todayStr   = new Date().toISOString().slice(0, 10);
                const botMsgs    = queue.filter((m) => m.messageKind === "template");
                const manualMsgs = queue.filter((m) => m.messageKind !== "template");

                function renderGroup(msgs: WaMessage[], label: string, icon: React.ReactNode, color: string) {
                  if (msgs.length === 0) return null;
                  const today  = msgs.filter((m) => (m.scheduledFor ?? m.createdAt).slice(0, 10) <= todayStr);
                  const future = msgs.filter((m) => (m.scheduledFor ?? m.createdAt).slice(0, 10) >  todayStr);
                  return (
                    <div className="space-y-2">
                      <div className={`flex items-center gap-1.5 text-[11px] font-semibold pt-1 ${color}`}>
                        {icon}
                        {label} · {msgs.length}
                      </div>
                      {today.map((m) => (
                        <MessageRow key={m.id} msg={m} showActions isToday
                          hasAutoSend={hasAutoSend} whatsappConfigured={whatsappConfigured}
                          onManualSent={markManualSent} onFailed={markFailed} onDelete={removeFromQueue} onEdit={updateMessage} />
                      ))}
                      {future.length > 0 && today.length > 0 && (
                        <p className="text-[10px] text-muted-foreground pt-1">Próximos dias</p>
                      )}
                      {future.map((m) => (
                        <MessageRow key={m.id} msg={m} showActions
                          hasAutoSend={hasAutoSend} whatsappConfigured={whatsappConfigured}
                          onManualSent={markManualSent} onFailed={markFailed} onDelete={removeFromQueue} onEdit={updateMessage} />
                      ))}
                    </div>
                  );
                }

                return (
                  <>
                    {renderGroup(
                      botMsgs,
                      "Automático — bot envia",
                      <Bot className="h-3 w-3" />,
                      "text-green-400",
                    )}
                    {botMsgs.length > 0 && manualMsgs.length > 0 && (
                      <div className="border-t border-border/40 pt-1" />
                    )}
                    {renderGroup(
                      manualMsgs,
                      "Manual — você envia",
                      <Send className="h-3 w-3" />,
                      "text-amber-400",
                    )}
                  </>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* ── Com falha ─────────────────────────────────────── */}
      {tab === "failed" && (
        <div className="space-y-2">
          {failed.length === 0
            ? <Empty icon={<XCircle className="h-8 w-8" />} text="Nenhuma falha. Ótimo!" />
            : failed.map((m) => (
                <MessageRow key={m.id} msg={m} showActions
                  onDelete={removeFromFailed} onRetry={retryMessage} />
              ))
          }
        </div>
      )}

      {/* ── Templates ─────────────────────────────────────── */}
      {tab === "templates" && <TemplatesTab hasWabaId={hasWabaId} />}
    </div>
  );
}
