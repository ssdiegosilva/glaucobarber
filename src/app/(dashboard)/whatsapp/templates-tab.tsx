"use client";

import { useState, useEffect } from "react";
import { isAiLimitError, triggerAiLimitModal } from "@/lib/ai-error";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2, Plus, Loader2, X, Check, MessageSquare, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface WaTemplate {
  id:        string;
  metaName:  string;
  label:     string;
  body:      string;
  variables: string;
  active:    boolean;
  kind:      string;
}

interface TemplateVar { key: string; label: string; defaultValue: string }

const BLANK_VAR: TemplateVar = { key: "", label: "", defaultValue: "" };

const AI_ACTION_OPTIONS = [
  { key: "post_sale",    label: "Pós-venda",         desc: "Após atendimento" },
  { key: "reactivation", label: "Reativação",         desc: "Cliente inativo" },
  { key: "promotion",    label: "Promoção",           desc: "Oferta especial" },
  { key: "review",       label: "Pedir avaliação",    desc: "Google / indicação" },
  { key: "followup",     label: "Acompanhamento",     desc: "Fidelização" },
];

// ── AI Generate Modal ─────────────────────────────────────────

function AiGenerateModal({ onClose, onGenerated }: {
  onClose: () => void;
  onGenerated: (label: string, body: string) => void;
}) {
  const [actionType,  setActionType]  = useState("post_sale");
  const [context,     setContext]     = useState("");
  const [generating,  setGenerating]  = useState(false);
  const [error,       setError]       = useState("");

  async function generate() {
    setGenerating(true);
    setError("");
    try {
      const res  = await fetch("/api/whatsapp/templates/ai-generate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ actionType, context: context.trim() || undefined }),
      });
      const data = await res.json();
      if (isAiLimitError(res.status, data)) { triggerAiLimitModal(); return; }
      if (!res.ok) { setError(data.error ?? "Erro ao gerar template"); return; }
      onGenerated(data.label, data.body);
      onClose();
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-50" onClick={onClose} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[60] rounded-xl border border-border bg-card shadow-2xl p-5 space-y-4 max-w-md mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold-400" />
            <h3 className="text-sm font-semibold">Gerar template com IA</h3>
          </div>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Tipo de ação</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {AI_ACTION_OPTIONS.map((opt) => (
              <button key={opt.key} onClick={() => setActionType(opt.key)}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                  actionType === opt.key
                    ? "border-gold-500/40 bg-gold-500/10 text-gold-400"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}>
                <p className="text-xs font-medium">{opt.label}</p>
                <p className="text-[10px] text-muted-foreground/70">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Contexto adicional <span className="text-muted-foreground/50">(opcional)</span>
          </label>
          <textarea value={context} onChange={(e) => setContext(e.target.value)} rows={2}
            placeholder="Ex: oferta de 20% em barba, lançamento de novo serviço..."
            className="w-full rounded-md border border-border bg-surface-900 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={generating}>Cancelar</Button>
          <Button className="flex-1 gap-1.5" onClick={generate} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? "Gerando..." : "Gerar"}
          </Button>
        </div>
      </div>
    </>
  );
}

// ── Templates Tab ─────────────────────────────────────────────

export function TemplatesTab({ hasWabaId }: { hasWabaId?: boolean }) {
  const [subTab,    setSubTab]    = useState<"text" | "meta">("text");
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [editId,    setEditId]    = useState<string | null>(null);
  const [syncing,   setSyncing]   = useState(false);
  const [syncMsg,   setSyncMsg]   = useState<string | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);

  // Form state
  const [metaName, setMetaName] = useState("");
  const [label,    setLabel]    = useState("");
  const [body,     setBody]     = useState("");
  const [vars,     setVars]     = useState<TemplateVar[]>([]);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    fetch("/api/whatsapp/templates")
      .then((r) => r.json())
      .then((data) => setTemplates(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const metaTemplates = templates.filter((t) => t.kind === "meta" || !t.kind);
  const textTemplates = templates.filter((t) => t.kind === "text");

  function openNew() {
    setEditId(null);
    setMetaName(""); setLabel(""); setBody(""); setVars([]);
    setShowForm(true);
  }

  function openEdit(t: WaTemplate) {
    setEditId(t.id);
    setMetaName(t.metaName);
    setLabel(t.label);
    setBody(t.body);
    setVars(JSON.parse(t.variables || "[]"));
    setShowForm(true);
  }

  function handleAiGenerated(generatedLabel: string, generatedBody: string) {
    setEditId(null);
    setMetaName("");
    setLabel(generatedLabel);
    setBody(generatedBody);
    setVars([]);
    setShowForm(true);
    toast({ title: "Template gerado com IA", description: "Revise e salve o template abaixo." });
  }

  async function save() {
    if (!label.trim() || !body.trim()) return;
    if (subTab === "meta" && !metaName.trim()) return;
    setSaving(true);
    try {
      if (editId) {
        const res = await fetch(`/api/whatsapp/templates/${editId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: label.trim(), body: body.trim(), variables: JSON.stringify(vars) }),
        });
        const updated = await res.json();
        setTemplates((prev) => prev.map((t) => t.id === editId ? updated : t));
        toast({ title: "Template atualizado" });
      } else {
        const res = await fetch("/api/whatsapp/templates", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            metaName: metaName.trim() || undefined,
            label:    label.trim(),
            body:     body.trim(),
            variables: JSON.stringify(vars),
            kind:     subTab,
          }),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
        const created = await res.json();
        setTemplates((prev) => [...prev, created]);
        toast({ title: "Template criado" });
      }
      setShowForm(false);
    } catch (e) {
      toast({ title: "Erro ao salvar", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remover este template?")) return;
    await fetch(`/api/whatsapp/templates/${id}`, { method: "DELETE" });
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    toast({ title: "Template removido" });
  }

  async function toggleActive(t: WaTemplate) {
    const res = await fetch(`/api/whatsapp/templates/${t.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !t.active }),
    });
    const updated = await res.json();
    setTemplates((prev) => prev.map((x) => x.id === t.id ? updated : x));
  }

  async function syncFromMeta() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res  = await fetch("/api/whatsapp/templates/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setSyncMsg(data.error ?? "Erro ao sincronizar"); return; }
      setSyncMsg(`${data.synced} template${data.synced !== 1 ? "s" : ""} sincronizado${data.synced !== 1 ? "s" : ""}`);
      const list = await fetch("/api/whatsapp/templates").then((r) => r.json());
      setTemplates(Array.isArray(list) ? list : []);
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando templates...
      </div>
    );
  }

  const currentList = subTab === "text" ? textTemplates : metaTemplates;

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex items-center gap-2 border-b border-border/40 pb-3">
        <button onClick={() => setSubTab("text")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            subTab === "text"
              ? "bg-gold-500/10 border border-gold-500/40 text-gold-400"
              : "text-muted-foreground hover:text-foreground"
          }`}>
          ✏️ Texto manual
        </button>
        <button onClick={() => setSubTab("meta")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            subTab === "meta"
              ? "bg-purple-500/10 border border-purple-500/40 text-purple-400"
              : "text-muted-foreground hover:text-foreground"
          }`}>
          🤖 Meta (bot)
        </button>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex-1 min-w-0">
          {subTab === "text" ? (
            <p className="text-xs text-muted-foreground leading-relaxed">
              Templates de texto para mensagens manuais. Use <code className="bg-surface-800 px-1 rounded text-[10px]">{"{{name}}"}</code> onde o nome do cliente deve aparecer — a IA personaliza automaticamente ao enviar.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground leading-relaxed">
              Templates aprovados na Meta Business. O nome deve ser exatamente igual ao cadastrado lá. Usados pelo bot para envio automático (fora da janela de 24h).
            </p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          {subTab === "text" && (
            <Button size="sm" variant="outline" onClick={() => setShowAiModal(true)} className="gap-1.5">
              <Sparkles className="h-4 w-4 text-gold-400" />
              <span className="hidden sm:inline">Gerar com IA</span>
            </Button>
          )}
          {subTab === "meta" && hasWabaId && (
            <Button size="sm" variant="outline" onClick={syncFromMeta} disabled={syncing} className="gap-1.5">
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="hidden sm:inline">Sincronizar da Meta</span>
            </Button>
          )}
          {subTab === "text" && (
            <Button size="sm" onClick={openNew} className="gap-1.5">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Novo template</span>
            </Button>
          )}
        </div>
      </div>

      {syncMsg && (
        <p className={`text-xs rounded-md border px-3 py-2 ${syncMsg.includes("Erro") ? "text-red-400 border-red-500/30 bg-red-500/5" : "text-green-400 border-green-500/30 bg-green-500/5"}`}>
          {syncMsg}
        </p>
      )}

      {/* Template list */}
      {currentList.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-12 text-center">
          <MessageSquare className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          {subTab === "text" ? (
            <>
              <p className="text-sm text-muted-foreground">Nenhum template de texto ainda.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Crie manualmente ou use a IA para gerar um.</p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Nenhum template Meta cadastrado.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {hasWabaId ? "Use \"Sincronizar da Meta\" ou crie manualmente." : "Cadastre o WABA ID nas Integrações para sincronizar."}
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {currentList.map((t) => (
            <div key={t.id} className="rounded-xl border border-border/60 bg-card p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">{t.label}</p>
                    <Badge variant="outline" className={`text-[10px] ${t.active ? "text-emerald-400 border-emerald-400/30" : "text-muted-foreground"}`}>
                      {t.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  {subTab === "meta" && (
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{t.metaName}</p>
                  )}
                </div>
                {subTab === "text" && (
                  <div className="flex gap-1.5 shrink-0">
                    <Button size="icon-sm" variant="ghost" onClick={() => toggleActive(t)} title={t.active ? "Desativar" : "Ativar"}>
                      {t.active ? <X className="h-3.5 w-3.5 text-muted-foreground" /> : <Check className="h-3.5 w-3.5 text-emerald-400" />}
                    </Button>
                    <Button size="icon-sm" variant="ghost" onClick={() => openEdit(t)}>
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button size="icon-sm" variant="ghost" onClick={() => remove(t.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </Button>
                  </div>
                )}
              </div>

              <p className="text-xs text-foreground/70 leading-relaxed whitespace-pre-wrap">{t.body}</p>

              {subTab === "meta" && (() => {
                const parsed: TemplateVar[] = JSON.parse(t.variables || "[]");
                return parsed.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {parsed.map((v, i) => (
                      <span key={v.key || i} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                        {`{{${i + 1}}}`} {v.label}
                      </span>
                    ))}
                  </div>
                ) : null;
              })()}
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50" onClick={() => setShowForm(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[60] rounded-xl border border-border bg-card shadow-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto max-w-xl mx-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{editId ? "Editar template" : `Novo template ${subTab === "text" ? "de texto" : "Meta"}`}</h3>
              <button onClick={() => setShowForm(false)} className="rounded p-1 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {subTab === "meta" && (
              <div className="rounded-lg bg-amber-500/8 border border-amber-500/20 px-3 py-2 text-xs text-amber-400 leading-relaxed">
                O <strong>Nome Meta</strong> deve ser exatamente igual ao nome do template aprovado no seu WhatsApp Business Manager.
              </div>
            )}
            {subTab === "text" && (
              <div className="rounded-lg bg-blue-500/8 border border-blue-500/20 px-3 py-2 text-xs text-blue-400 leading-relaxed">
                Use <code className="bg-surface-800 px-1 rounded">{"{{name}}"}</code> onde o nome do cliente deve aparecer. A IA personaliza a mensagem ao enviar.
              </div>
            )}

            <div className="space-y-3">
              {subTab === "meta" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Nome Meta (exato, ex: review_request)</label>
                  <Input
                    value={metaName}
                    onChange={(e) => setMetaName(e.target.value)}
                    placeholder="nome_do_template_na_meta"
                    className="mt-1 font-mono text-sm"
                    disabled={!!editId}
                  />
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Label (como aparece para você)</label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ex: Pedir avaliação Google" className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {subTab === "text"
                    ? <>Corpo do template — use <code className="bg-surface-800 px-1 rounded text-[10px]">{"{{name}}"}</code> para o nome do cliente</>
                    : <>Corpo do template — use {`{{1}}`}, {`{{2}}`}... para variáveis</>
                  }
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={5}
                  className="mt-1 w-full rounded-md border border-border bg-surface-900 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  placeholder={subTab === "text"
                    ? "Olá, {{name}}! Obrigado pela visita hoje..."
                    : "Olá {{1}}! Obrigado pela visita na {{2}}..."
                  }
                />
              </div>

              {subTab === "meta" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">Variáveis (na ordem das posições)</label>
                    <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => setVars((p) => [...p, { ...BLANK_VAR }])}>
                      <Plus className="h-3 w-3 mr-1" /> Adicionar
                    </Button>
                  </div>
                  {vars.length === 0 && (
                    <p className="text-[11px] text-muted-foreground">Sem variáveis. Se o template tiver {`{{1}}`}, adicione uma variável para cada posição.</p>
                  )}
                  {vars.map((v, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <span className="text-[10px] text-muted-foreground w-8 shrink-0">{`{{${i + 1}}}`}</span>
                      <Input
                        value={v.label}
                        onChange={(e) => { const n = [...vars]; n[i] = { ...n[i], label: e.target.value, key: e.target.value.toLowerCase().replace(/\s+/g, "_") }; setVars(n); }}
                        placeholder="Nome da variável (ex: Nome do cliente)"
                        className="flex-1 h-7 text-xs"
                      />
                      <Input
                        value={v.defaultValue}
                        onChange={(e) => { const n = [...vars]; n[i] = { ...n[i], defaultValue: e.target.value }; setVars(n); }}
                        placeholder="Valor padrão"
                        className="w-28 h-7 text-xs"
                      />
                      <Button size="icon-sm" variant="ghost" onClick={() => setVars((p) => p.filter((_, j) => j !== i))}>
                        <X className="h-3.5 w-3.5 text-red-400" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)} disabled={saving}>Cancelar</Button>
              <Button className="flex-1" onClick={save}
                disabled={saving || !label.trim() || !body.trim() || (subTab === "meta" && !editId && !metaName.trim())}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Salvar
              </Button>
            </div>
          </div>
        </>
      )}

      {showAiModal && (
        <AiGenerateModal
          onClose={() => setShowAiModal(false)}
          onGenerated={handleAiGenerated}
        />
      )}
    </div>
  );
}
