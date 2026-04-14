"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Store,
  Loader2,
  Plus,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SEGMENT_ICON_MAP } from "@/components/layout/sidebar";

const ICON_OPTIONS = Object.keys(SEGMENT_ICON_MAP);
const ICON_MAP = SEGMENT_ICON_MAP;

interface ServiceCategory {
  key: string;
  label: string;
}

interface SegmentFormProps {
  segment: {
    id: string;
    key: string;
    displayName: string;
    tenantLabel: string;
    description: string | null;
    icon: string | null;
    colorPrimary:    string;
    colorBackground: string;
    colorCard:       string;
    active: boolean;
    sortOrder: number;
    availableModules: string;
    serviceCategories: string;
    roles: string;
    aiConfig: {
      copilotSystemPrompt: string;
      suggestionsSystemPrompt: string;
      campaignTextSystemPrompt: string;
      brandStyleSystemPrompt: string;
      serviceAnalysisSystemPrompt: string;
      vitrineCaptionSystemPrompt: string;
      haircutVisualPrompt: string;
      featureCosts: string;
      imageFeatures: string;
    } | null;
  };
  allFeatures: Array<{ key: string; label: string }>;
}

export function SegmentForm({ segment, allFeatures }: SegmentFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // ── General fields ────────────────────────────────────────────
  const [displayName, setDisplayName] = useState(segment.displayName);
  const [tenantLabel, setTenantLabel] = useState(segment.tenantLabel);
  const [description, setDescription] = useState(segment.description ?? "");
  const [icon, setIcon] = useState(segment.icon ?? "Store");
  const [active, setActive] = useState(segment.active);
  const [sortOrder, setSortOrder] = useState(segment.sortOrder);

  // ── Theme ─────────────────────────────────────────────────────
  const [colorPrimary,    setColorPrimary]    = useState(segment.colorPrimary);
  const [colorBackground, setColorBackground] = useState(segment.colorBackground);
  const [colorCard,       setColorCard]       = useState(segment.colorCard);

  // ── Modules ───────────────────────────────────────────────────
  const [availableModules, setAvailableModules] = useState<string[]>(() => {
    try { return JSON.parse(segment.availableModules); } catch { return []; }
  });

  // ── Service categories ────────────────────────────────────────
  const [categories, setCategories] = useState<ServiceCategory[]>(() => {
    try { return JSON.parse(segment.serviceCategories); } catch { return []; }
  });

  // ── AI Prompts ────────────────────────────────────────────────
  const ai = segment.aiConfig;
  const [copilotPrompt, setCopilotPrompt] = useState(ai?.copilotSystemPrompt ?? "");
  const [suggestionsPrompt, setSuggestionsPrompt] = useState(ai?.suggestionsSystemPrompt ?? "");
  const [campaignTextPrompt, setCampaignTextPrompt] = useState(ai?.campaignTextSystemPrompt ?? "");
  const [brandStylePrompt, setBrandStylePrompt] = useState(ai?.brandStyleSystemPrompt ?? "");
  const [serviceAnalysisPrompt, setServiceAnalysisPrompt] = useState(ai?.serviceAnalysisSystemPrompt ?? "");
  const [vitrineCaptionPrompt, setVitrineCaptionPrompt] = useState(ai?.vitrineCaptionSystemPrompt ?? "");
  const [haircutVisualPrompt, setHaircutVisualPrompt] = useState(ai?.haircutVisualPrompt ?? "");

  function toggleModule(key: string) {
    setAvailableModules((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function addCategory() {
    setCategories((prev) => [...prev, { key: `cat_${Date.now()}`, label: "" }]);
  }

  function removeCategory(idx: number) {
    setCategories((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateCategory(idx: number, field: "key" | "label", value: string) {
    setCategories((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c))
    );
  }

  async function save(patch: Record<string, unknown>) {
    setSaving(true);
    await fetch(`/api/admin/segments/${segment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    router.refresh();
  }

  async function saveGeneral() {
    await save({ displayName, tenantLabel, description, icon, active, sortOrder });
  }

  async function saveTheme() {
    await save({ colorPrimary, colorBackground, colorCard });
  }

  async function saveModules() {
    await save({ availableModules });
  }

  async function saveCategories() {
    await save({ serviceCategories: categories });
  }

  async function savePrompts() {
    await save({
      aiConfig: {
        copilotSystemPrompt: copilotPrompt,
        suggestionsSystemPrompt: suggestionsPrompt,
        campaignTextSystemPrompt: campaignTextPrompt,
        brandStyleSystemPrompt: brandStylePrompt,
        serviceAnalysisSystemPrompt: serviceAnalysisPrompt,
        vitrineCaptionSystemPrompt: vitrineCaptionPrompt,
        haircutVisualPrompt: haircutVisualPrompt,
      },
    });
  }

  const PreviewIcon = ICON_MAP[icon] ?? Store;

  return (
    <div className="space-y-4">
      {saved && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          Salvo com sucesso!
        </div>
      )}

      <Tabs defaultValue="general">
        <TabsList className="mb-6">
          <TabsTrigger value="general">Geral</TabsTrigger>
          <TabsTrigger value="theme">Tema</TabsTrigger>
          <TabsTrigger value="modules">Módulos</TabsTrigger>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
          <TabsTrigger value="prompts">Prompts IA</TabsTrigger>
        </TabsList>

        {/* ── Tab: General ──────────────────────────────────────── */}
        <TabsContent value="general" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Nome de exibição</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Label do tenant</label>
              <input
                value={tenantLabel}
                onChange={(e) => setTenantLabel(e.target.value)}
                placeholder="barbearia, salão, estúdio..."
                className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Descrição (exibida no onboarding)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Ícone (nome Lucide)</label>
            <div className="flex flex-wrap gap-2">
              {ICON_OPTIONS.map((name) => {
                const Ic = ICON_MAP[name];
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setIcon(name)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border p-3 text-xs transition-all",
                      icon === name
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-surface-800 text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    <Ic className="h-4 w-4" />
                    {name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Ordem</label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="w-20 rounded-md border border-border bg-surface-800 px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer mt-5">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm text-foreground">Ativo</span>
            </label>
          </div>

          <Button onClick={saveGeneral} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar
          </Button>
        </TabsContent>

        {/* ── Tab: Theme ────────────────────────────────────────── */}
        <TabsContent value="theme" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {/* Primary */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Cor primária <code className="text-[10px] text-muted-foreground">--primary</code>
              </label>
              <div className="flex items-center gap-2">
                <input value={colorPrimary} onChange={(e) => setColorPrimary(e.target.value)}
                  placeholder="43 52% 55%" className="flex-1 rounded-md border border-border bg-surface-800 px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring" />
                <div className="h-7 w-7 rounded border border-border shrink-0" style={{ backgroundColor: `hsl(${colorPrimary})` }} />
              </div>
            </div>
            {/* Background */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Fundo <code className="text-[10px] text-muted-foreground">--background</code>
              </label>
              <div className="flex items-center gap-2">
                <input value={colorBackground} onChange={(e) => setColorBackground(e.target.value)}
                  placeholder="240 11% 7%" className="flex-1 rounded-md border border-border bg-surface-800 px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring" />
                <div className="h-7 w-7 rounded border border-border shrink-0" style={{ backgroundColor: `hsl(${colorBackground})` }} />
              </div>
            </div>
            {/* Card */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Card <code className="text-[10px] text-muted-foreground">--card</code>
              </label>
              <div className="flex items-center gap-2">
                <input value={colorCard} onChange={(e) => setColorCard(e.target.value)}
                  placeholder="240 10% 11%" className="flex-1 rounded-md border border-border bg-surface-800 px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring" />
                <div className="h-7 w-7 rounded border border-border shrink-0" style={{ backgroundColor: `hsl(${colorCard})` }} />
              </div>
            </div>
          </div>

          {/* Preview dashboard mockup */}
          <div className="rounded-xl overflow-hidden border border-border">
            <p className="text-[10px] text-muted-foreground px-3 py-1.5 border-b border-border">Preview</p>
            <div className="h-32 flex" style={{ background: `hsl(${colorBackground})` }}>
              {/* Fake sidebar */}
              <div className="w-14 flex flex-col items-center gap-2 pt-3 shrink-0" style={{ background: `hsl(${colorCard})` }}>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `hsl(${colorPrimary} / 0.2)` }}>
                  <PreviewIcon className="h-4 w-4" style={{ color: `hsl(${colorPrimary})` }} />
                </div>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-1.5 w-10 rounded px-1.5 py-1"
                    style={i === 1 ? { background: `hsl(${colorPrimary} / 0.15)` } : undefined}>
                    <div className="h-2 w-2 rounded-sm" style={{ background: i === 1 ? `hsl(${colorPrimary})` : `hsl(${colorPrimary} / 0.3)` }} />
                  </div>
                ))}
              </div>
              {/* Fake content */}
              <div className="flex-1 p-3 flex flex-col gap-2">
                <div className="flex gap-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex-1 rounded-lg p-2 border" style={{ background: `hsl(${colorCard})`, borderColor: `hsl(${colorPrimary} / 0.15)` }}>
                      <div className="h-1.5 w-8 rounded" style={{ background: `hsl(${colorPrimary} / 0.4)` }} />
                      <div className="h-3 w-6 rounded mt-1" style={{ background: `hsl(${colorPrimary})` }} />
                    </div>
                  ))}
                </div>
                <div className="rounded-lg p-2 border flex-1" style={{ background: `hsl(${colorCard})`, borderColor: `hsl(${colorPrimary} / 0.15)` }}>
                  <div className="flex gap-1 mb-1.5">
                    <div className="h-1.5 w-12 rounded" style={{ background: `hsl(${colorPrimary} / 0.5)` }} />
                  </div>
                  <div className="h-1.5 w-full rounded mb-1 opacity-30" style={{ background: `hsl(${colorPrimary})` }} />
                  <div className="h-1.5 w-3/4 rounded opacity-20" style={{ background: `hsl(${colorPrimary})` }} />
                </div>
              </div>
            </div>
          </div>

          <Button onClick={saveTheme} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar tema
          </Button>
        </TabsContent>

        {/* ── Tab: Modules ──────────────────────────────────────── */}
        <TabsContent value="modules" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Módulos visíveis no menu para este segmento. Configurações, Plano e Suporte são sempre visíveis.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {allFeatures.map(({ key, label }) => {
              const checked = availableModules.includes(key);
              return (
                <label
                  key={key}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-all",
                    checked
                      ? "border-primary/40 bg-primary/10"
                      : "border-border bg-surface-800 hover:border-border/80"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleModule(key)}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm text-foreground">{label}</span>
                </label>
              );
            })}
          </div>
          <Button onClick={saveModules} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar módulos
          </Button>
        </TabsContent>

        {/* ── Tab: Categories ───────────────────────────────────── */}
        <TabsContent value="categories" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Categorias de serviço disponíveis para este segmento. A chave (<code className="text-[11px]">key</code>) é usada internamente.
          </p>
          <div className="space-y-2">
            {categories.map((cat, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  value={cat.key}
                  onChange={(e) => updateCategory(idx, "key", e.target.value)}
                  placeholder="chave"
                  className="w-32 rounded-md border border-border bg-surface-800 px-2.5 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  value={cat.label}
                  onChange={(e) => updateCategory(idx, "label", e.target.value)}
                  placeholder="Label visível"
                  className="flex-1 rounded-md border border-border bg-surface-800 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => removeCategory(idx)}
                  className="text-muted-foreground hover:text-red-400 transition-colors p-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addCategory}>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
            <Button onClick={saveCategories} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </div>
        </TabsContent>

        {/* ── Tab: AI Prompts ───────────────────────────────────── */}
        <TabsContent value="prompts" className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Edite os prompts de IA deste segmento. As alterações entram em vigor na próxima chamada (cache de 5 min).
          </p>

          {[
            { label: "Copilot (sistema)", value: copilotPrompt, onChange: setCopilotPrompt },
            { label: "Sugestões diárias", value: suggestionsPrompt, onChange: setSuggestionsPrompt },
            { label: "Texto de campanha", value: campaignTextPrompt, onChange: setCampaignTextPrompt },
            { label: "Identidade visual (brand style)", value: brandStylePrompt, onChange: setBrandStylePrompt },
            { label: "Análise de serviço / corte", value: serviceAnalysisPrompt, onChange: setServiceAnalysisPrompt },
            { label: "Legenda da vitrine (Instagram)", value: vitrineCaptionPrompt, onChange: setVitrineCaptionPrompt },
            { label: "Visual de corte (imagem)", value: haircutVisualPrompt, onChange: setHaircutVisualPrompt },
          ].map(({ label, value, onChange }) => (
            <div key={label} className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">{label}</label>
              <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          ))}

          <Button onClick={savePrompts} disabled={saving} className="bg-purple-600 hover:bg-purple-500 text-white">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar prompts (invalida cache)
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
