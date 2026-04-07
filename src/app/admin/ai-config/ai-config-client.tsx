"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, Cpu, BarChart3, CheckCircle2, Lightbulb, Loader2, ImageOff, AlertTriangle } from "lucide-react";

// ── Tier table — 3 rows, one per quality tier ────────────────────────────────
// breakEven = costCents × 10  (1 crédito = $0.001)
// margin80  = costCents × 50  (80% de margem)
const TIER_TABLE = [
  { tier: "low",    label: "Rascunho",       creditKey: "ai_image_credit_cost_low",    costCents: 4,  breakEven: 40,  margin80: 200 },
  { tier: "medium", label: "Padrão",         creditKey: "ai_image_credit_cost_medium", costCents: 7,  breakEven: 70,  margin80: 350 },
  { tier: "high",   label: "Alta qualidade", creditKey: "ai_image_credit_cost_high",   costCents: 19, breakEven: 190, margin80: 950 },
] as const;

// Custo real por tier/modelo — referência somente visual na tabela
const COST_BY_MODEL: Record<string, { low: number; medium: number; high: number }> = {
  "gpt-image-1": { low: 4, medium: 7,  high: 19 },
  "dall-e-3":    { low: 4, medium: 4,  high: 8  }, // standard=low/medium, hd=high
  "dall-e-2":    { low: 2, medium: 2,  high: 2  }, // always standard
};

const MODEL_OPTIONS = ["gpt-image-1", "dall-e-3", "dall-e-2"] as const;

const SIZE_OPTIONS_BY_MODEL: Record<string, string[]> = {
  "gpt-image-1": ["1024x1024", "1024x1536", "1536x1024", "auto"],
  "dall-e-3":    ["1024x1024", "1792x1024", "1024x1792"],
  "dall-e-2":    ["256x256", "512x512", "1024x1024"],
};

interface CostData {
  trialStats: {
    count:             number;
    totalCostUsdCents: number;
    avgCostUsdCents:   number;
  };
  planBreakdown: {
    tier:                  string;
    shopCount:             number;
    totalUsage:            number;
    estimatedCostUsdCents: number;
    planRevenueCents:      number;
  }[];
  imageStats: {
    count:             number;
    totalCostUsdCents: number;
  };
}

export function AiConfigClient({ current, killImageGeneration: initialKill }: { current: Record<string, string>; killImageGeneration: boolean }) {
  const [values,      setValues]      = useState<Record<string, string>>({ ...current });
  const [saving,      setSaving]      = useState(false);
  const [msg,         setMsg]         = useState("");
  const [costData,    setCostData]    = useState<CostData | null>(null);
  const [loadingCost, setLoadingCost] = useState(true);
  const [killImage,   setKillImage]   = useState(initialKill);
  const [togglingKill,setTogglingKill]= useState(false);

  useEffect(() => {
    fetch("/api/admin/ai-cost")
      .then((r) => r.json())
      .then((d) => { setCostData(d); setLoadingCost(false); })
      .catch(() => setLoadingCost(false));
  }, []);

  const activeModel = values["ai_image_model"] || "gpt-image-1";
  const activeSize  = values["ai_image_size"]  || "1024x1024";

  async function toggleKillImage() {
    const newVal = !killImage;
    setTogglingKill(true);
    try {
      await fetch("/api/admin/platform-config", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ key: "kill_image_generation", value: String(newVal) }),
      });
      setKillImage(newVal);
    } finally {
      setTogglingKill(false);
    }
  }

  async function save() {
    setSaving(true); setMsg("");
    try {
      const res = await fetch("/api/admin/ai-config", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(values),
      });
      setMsg(res.ok ? "✅ Configurações salvas!" : "❌ Erro ao salvar");
    } catch {
      setMsg("❌ Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const modelCosts = COST_BY_MODEL[activeModel] ?? COST_BY_MODEL["gpt-image-1"];

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-foreground">Configuração de IA — Imagens</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Controla qual modelo de imagem é usado e quanto cobrar dos usuários por geração.
        </p>
      </div>

      {/* ── Emergency kill switch ──────────────────────────────────────────── */}
      <div className={`rounded-lg border p-4 flex items-center gap-4 ${
        killImage
          ? "border-red-500/60 bg-red-500/10"
          : "border-border bg-surface-800/40"
      }`}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <ImageOff className={`h-5 w-5 shrink-0 ${killImage ? "text-red-400" : "text-muted-foreground"}`} />
          <div>
            <p className={`text-sm font-semibold ${killImage ? "text-red-400" : "text-foreground"}`}>
              {killImage ? "⚠️ Geração de imagens DESLIGADA" : "Geração de imagens"}
            </p>
            <p className="text-xs text-muted-foreground">
              {killImage
                ? "Campanhas e Criar Visual retornam erro imediatamente. Zero custo OpenAI."
                : "Ativo — campanhas e Criar Visual geram imagens normalmente."}
            </p>
          </div>
        </div>
        <Button
          onClick={toggleKillImage}
          disabled={togglingKill}
          className={`shrink-0 text-xs h-8 gap-1.5 ${
            killImage
              ? "bg-green-600 hover:bg-green-500 text-white"
              : "bg-red-600 hover:bg-red-500 text-white"
          }`}
        >
          {togglingKill
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <AlertTriangle className="h-3.5 w-3.5" />
          }
          {killImage ? "Religar imagens" : "Desligar imagens"}
        </Button>
      </div>

      {/* ── Section 1: Config form ──────────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-surface-800/60 p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Modelo ativo</span>
          <span className="ml-auto text-[11px] text-muted-foreground font-mono">
            {activeModel} / {activeSize}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Modelo</label>
            <select
              value={values["ai_image_model"] ?? "gpt-image-1"}
              onChange={(e) => {
                const newModel   = e.target.value;
                const validSizes = SIZE_OPTIONS_BY_MODEL[newModel] ?? ["1024x1024"];
                const currentSize = values["ai_image_size"] ?? "1024x1024";
                const newSize    = validSizes.includes(currentSize) ? currentSize : "1024x1024";
                setValues((v) => ({ ...v, ai_image_model: newModel, ai_image_size: newSize }));
              }}
              className="w-full rounded-md border border-border bg-surface-900 px-3 py-2 text-sm text-foreground"
            >
              {MODEL_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <p className="text-[10px] text-muted-foreground">
              {activeModel === "gpt-image-1" ? "Suporta foto de referência (images.edit)" : "Geração sem referência"}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Tamanho</label>
            <select
              value={values["ai_image_size"] ?? "1024x1024"}
              onChange={(e) => setValues((v) => ({ ...v, ai_image_size: e.target.value }))}
              className="w-full rounded-md border border-border bg-surface-900 px-3 py-2 text-sm text-foreground"
            >
              {(SIZE_OPTIONS_BY_MODEL[activeModel] ?? ["1024x1024"]).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <p className="text-[10px] text-muted-foreground">Qualidade é escolhida pelo usuário na hora de gerar</p>
          </div>
        </div>

        {/* Credit costs per quality tier */}
        <div className="space-y-2 pt-1">
          <p className="text-xs font-semibold text-muted-foreground">Créditos cobrados por tier de qualidade</p>
          <div className="grid grid-cols-3 gap-3">
            {(["low", "medium", "high"] as const).map((tier) => {
              const key = `ai_image_credit_cost_${tier}` as const;
              const defaults: Record<string, string> = { low: "40", medium: "70", high: "190" };
              const labels: Record<string, string> = { low: "Rascunho", medium: "Padrão", high: "Alta qualidade" };
              const colors: Record<string, string> = { low: "text-green-400", medium: "text-amber-400", high: "text-red-400" };
              return (
                <div key={tier} className="space-y-1.5">
                  <label className={`text-xs font-medium ${colors[tier]}`}>{labels[tier]}</label>
                  <Input
                    type="number"
                    min={1}
                    value={values[key] ?? defaults[tier]}
                    onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                    className="font-mono text-sm"
                  />
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground">
            O usuário escolhe o tier ao gerar a imagem e vê quantos créditos vai gastar antes de confirmar.
          </p>
        </div>

        <p className="text-[10px] text-muted-foreground/60 pt-1">
          Custo OpenAI por tier é fixo pelo modelo ativo — Rascunho ${(modelCosts.low / 100).toFixed(3)} · Padrão ${(modelCosts.medium / 100).toFixed(3)} · Alta ${(modelCosts.high / 100).toFixed(3)}
        </p>

        <div className="flex items-center gap-3">
          <Button
            onClick={save}
            disabled={saving}
            className="bg-red-500/80 hover:bg-red-500 text-white text-xs h-8 gap-1.5"
          >
            {saving
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Save className="h-3.5 w-3.5" />
            }
            {saving ? "Salvando…" : "Salvar configurações"}
          </Button>
          {msg && <span className="text-sm">{msg}</span>}
        </div>
      </div>

      {/* ── Section 2: Tier reference table ─────────────────────────────────── */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-3 bg-surface-800 border-b border-border flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">Referência por tier</span>
          <span className="text-[10px] text-muted-foreground ml-auto">
            Custos para modelo ativo: <span className="font-mono">{activeModel}</span> — clique para preencher o crédito do tier
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-800/50">
              <tr>
                {["Tier", "Custo OpenAI", "Break-even", "80% margem", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {TIER_TABLE.map((row) => {
                const costCentsForModel = modelCosts[row.tier as keyof typeof modelCosts];
                const breakEven = costCentsForModel * 10;
                const margin80  = costCentsForModel * 50;
                const currentCredits = parseInt(values[row.creditKey] ?? "") || row.breakEven;
                const active = currentCredits === breakEven;
                return (
                  <tr
                    key={row.tier}
                    onClick={() => setValues((v) => ({ ...v, [row.creditKey]: String(breakEven) }))}
                    className="cursor-pointer hover:bg-surface-800/40 transition-colors"
                  >
                    <td className="px-4 py-3 text-xs font-semibold text-foreground">{row.label}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-amber-400 whitespace-nowrap">${(costCentsForModel / 100).toFixed(3)}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-blue-400 whitespace-nowrap">{breakEven} cred.</td>
                    <td className="px-4 py-3 text-xs font-semibold text-green-400 whitespace-nowrap">{margin80} cred.</td>
                    <td className="px-4 py-3 text-center">
                      {active && <CheckCircle2 className="h-4 w-4 text-blue-400 mx-auto" />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 bg-surface-800/30 border-t border-border/40">
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Lightbulb className="h-3 w-3 text-amber-400 shrink-0" />
            Break-even = mínimo para se pagar (1 crédito = $0.001). 80% margem = break-even × 5.
          </p>
        </div>
      </div>

      {/* ── Section 3: Profitability stats ─────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-surface-800/60 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Lucratividade — mês atual</span>
          <span className="text-[10px] text-muted-foreground ml-auto">
            Custo baseado em calls registradas (últimas 50/barbearia)
          </span>
        </div>

        {loadingCost ? (
          <div className="flex items-center gap-2 py-4 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Carregando dados...</span>
          </div>
        ) : costData ? (
          <>
            {/* Trial stats */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Trials</p>
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="Trials ativos" value={String(costData.trialStats.count)} />
                <StatCard
                  label="Custo total trials"
                  value={`$${(costData.trialStats.totalCostUsdCents / 100).toFixed(2)}`}
                  color="text-amber-400"
                />
                <StatCard
                  label="Custo médio/trial"
                  value={`$${(costData.trialStats.avgCostUsdCents / 100).toFixed(2)}`}
                  color="text-amber-400"
                />
              </div>
            </div>

            {/* Plan breakdown */}
            {costData.planBreakdown.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Por plano (assinantes)</p>
                <div className="rounded-md border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-800/50">
                      <tr>
                        {["Plano", "Barbearias", "Uso IA (créditos)", "Custo estimado", "Receita plano"].map((h) => (
                          <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {costData.planBreakdown.map((row) => (
                        <tr key={row.tier} className="hover:bg-surface-800/30">
                          <td className="px-4 py-2 text-xs font-semibold text-foreground">{row.tier}</td>
                          <td className="px-4 py-2 text-xs text-muted-foreground">{row.shopCount}</td>
                          <td className="px-4 py-2 text-xs text-muted-foreground">{row.totalUsage}</td>
                          <td className="px-4 py-2 text-xs text-amber-400 font-medium">
                            ${(row.estimatedCostUsdCents / 100).toFixed(2)}
                          </td>
                          <td className="px-4 py-2 text-xs text-green-400 font-medium">
                            {row.planRevenueCents > 0
                              ? `R$${(row.planRevenueCents * row.shopCount / 100).toFixed(0)}`
                              : <span className="text-muted-foreground">—</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Receita = estimativa baseada em preço base do plano × número de barbearias ativas.
                </p>
              </div>
            )}

            {/* Image stats */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Imagens geradas (mês)</p>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Total de imagens" value={String(costData.imageStats.count)} />
                <StatCard
                  label="Custo real imagens"
                  value={`$${(costData.imageStats.totalCostUsdCents / 100).toFixed(2)}`}
                  color="text-amber-400"
                />
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground py-2">Sem dados de custo disponíveis ainda.</p>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color = "text-foreground" }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-900/60 px-4 py-3 space-y-1">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
