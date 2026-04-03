"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2, Plus, Loader2, X, Check, MessageSquare } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface WaTemplate {
  id:        string;
  metaName:  string;
  label:     string;
  body:      string;
  variables: string;
  active:    boolean;
}

interface TemplateVar { key: string; label: string; defaultValue: string }

const BLANK_VAR: TemplateVar = { key: "", label: "", defaultValue: "" };

export function TemplatesTab() {
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [editId,    setEditId]    = useState<string | null>(null);

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

  async function save() {
    if (!metaName.trim() || !label.trim() || !body.trim()) return;
    setSaving(true);
    try {
      const payload = { metaName: metaName.trim(), label: label.trim(), body: body.trim(), variables: JSON.stringify(vars) };
      if (editId) {
        const res = await fetch(`/api/whatsapp/templates/${editId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        const updated = await res.json();
        setTemplates((prev) => prev.map((t) => t.id === editId ? updated : t));
        toast({ title: "Template atualizado" });
      } else {
        const res = await fetch("/api/whatsapp/templates", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
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

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando templates...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-lg">
            Cadastre aqui os templates aprovados na sua conta Meta Business. O nome deve ser exatamente igual ao cadastrado lá.
            Templates são usados para mensagens proativas (fora da janela de 24h).
          </p>
        </div>
        <Button size="sm" onClick={openNew} className="gap-1.5 shrink-0">
          <Plus className="h-4 w-4" /> Novo template
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-12 text-center">
          <MessageSquare className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum template cadastrado ainda.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Crie seu primeiro template para usar nos envios do WhatsApp.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div key={t.id} className="rounded-xl border border-border/60 bg-card p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">{t.label}</p>
                    <Badge variant="outline" className={`text-[10px] ${t.active ? "text-emerald-400 border-emerald-400/30" : "text-muted-foreground"}`}>
                      {t.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{t.metaName}</p>
                </div>
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
              </div>

              <p className="text-xs text-foreground/70 leading-relaxed whitespace-pre-wrap">{t.body}</p>

              {(() => {
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
              <h3 className="text-sm font-semibold">{editId ? "Editar template" : "Novo template"}</h3>
              <button onClick={() => setShowForm(false)} className="rounded p-1 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-lg bg-amber-500/8 border border-amber-500/20 px-3 py-2 text-xs text-amber-400 leading-relaxed">
              O <strong>Nome Meta</strong> deve ser exatamente igual ao nome do template aprovado no seu WhatsApp Business Manager.
            </div>

            <div className="space-y-3">
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
              <div>
                <label className="text-xs font-medium text-muted-foreground">Label (como aparece para você)</label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ex: Pedir avaliação Google" className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Corpo do template — use {`{{1}}`}, {`{{2}}`}... para variáveis
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-md border border-border bg-surface-900 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  placeholder="Olá {{1}}! Obrigado pela visita na {{2}}..."
                />
              </div>

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
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)} disabled={saving}>Cancelar</Button>
              <Button className="flex-1" onClick={save} disabled={saving || !metaName.trim() || !label.trim() || !body.trim()}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Salvar
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
