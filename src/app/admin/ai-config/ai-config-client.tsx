"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, Cpu, BarChart3, CheckCircle2, Lightbulb, Loader2 } from "lucide-react";

// ── Model comparison table (hardcoded reference data) ─────────────────────────

const MODEL_TABLE = [
  { model: "gpt-image-1", size: "1024x1024", quality: "standard", usdCost: "$0.04",  notes: "Melhor qualidade, suporta foto de referência" },
  { model: "dall-e-3",    size: "1024x1024", quality: "standard", usdCost: "$0.04",  notes: "Boa qualidade, sem referência" },
  { model: "dall-e-3",    size: "1024x1024", quality: "hd",       usdCost: "$0.08",  notes: "Alta qualidade (HD), sem referência" },
  { model: "dall-e-2",    size: "1024x1024", quality: "standard", usdCost: "$0.020", notes: "Qualidade básica, sem referência" },
  { model: "dall-e-2",    size: "512x512",   quality: "standard", usdCost: "$0.018", notes: "Testes e dev — mais barato" },
  { model: "dall-e-2",    size: "256x256",   quality: "standard", usdCost: "$0.016", notes: "Só para testes, qualidade baixa" },
] as const;

const MODEL_OPTIONS   = ["gpt-image-1", "dall-e-3", "dall-e-2"] as const;
const QUALITY_OPTIONS = ["standard", "hd"] as const;

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

export function AiConfigClient({ current }: { current: Record<string, string> }) {
  const [values,      setValues]      = useState<Record<string, string>>({ ...current });
  const [saving,      setSaving]      = useState(false);
  const [msg,         setMsg]         = useState("");
  const [costData,    setCostData]    = useState<CostData | null>(null);
  const [loadingCost, setLoadingCost] = useState(true);

  useEffect(() => {
    fetch("/api/admin/ai-cost")
      .then((r) => r.json())
      .then((d) => { setCostData(d); setLoadingCost(false); })
      .catch(() => setLoadingCost(false));
  }, []);

  const activeModel   = values["ai_image_model"]   || "gpt-image-1";
  const activeSize    = values["ai_image_size"]     || "1024x1024";
  const activeQuality = values["ai_image_quality"]  || "standard";

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

  const isActiveRow = (row: (typeof MODEL_TABLE)[number]) =>
    row.model === activeModel && row.size === activeSize && row.quality === activeQuality;

  const creditCost = parseInt(values["ai_image_credit_cost"] ?? "10") || 10;
  const costCents  = parseInt(values["ai_image_cost_usd_cents"] ?? "4") || 4;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-foreground">Configuração de IA — Imagens</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Controla qual modelo de imagem é usado e quanto cobrar dos usuários por geração.
        </p>
      </div>

      {/* ── Section 1: Config form ──────────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-surface-800/60 p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Modelo ativo</span>
          <span className="ml-auto text-[11px] text-muted-foreground font-mono">
            {activeModel} / {activeSize}{activeModel === "dall-e-3" ? ` / ${activeQuality}` : ""}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Modelo</label>
            <select
              value={values["ai_image_model"] ?? "gpt-image-1"}
              onChange={(e) => {
                const newModel = e.target.value;
                const validSizes = SIZE_OPTIONS_BY_MODEL[newModel] ?? ["1024x1024"];
                const currentSize = values["ai_image_size"] ?? "1024x1024";
                const newSize = validSizes.includes(currentSize) ? currentSize : "1024x1024";
                setValues((v) => ({ ...v, ai_image_model: newModel, ai_image_size: newSize }));
              }}
              className="w-full rounded-md border border-border bg-surface-900 px-3 py-2 text-sm text-foreground"
            >
              {MODEL_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
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
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Qualidade{" "}
              <span className="text-muted-foreground/50">(só dall-e-3)</span>
            </label>
            <select
              value={values["ai_image_quality"] ?? "standard"}
              onChange={(e) => setValues((v) => ({ ...v, ai_image_quality: e.target.value }))}
              disabled={activeModel !== "dall-e-3"}
              className="w-full rounded-md border border-border bg-surface-900 px-3 py-2 text-sm text-foreground disabled:opacity-40"
            >
              {QUALITY_OPTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Créditos cobrados do usuário por imagem
            </label>
            <Input
              type="number"
              min={1}
              value={values["ai_image_credit_cost"] ?? "10"}
              onChange={(e) => setValues((v) => ({ ...v, ai_image_credit_cost: e.target.value }))}
              className="font-mono text-sm"
            />
            <p className="text-[10px] text-muted-foreground">
              1 campanha completa = 1 texto + {creditCost} imagem = {1 + creditCost} créditos
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Custo real por imagem (centavos USD)
            </label>
            <Input
              type="number"
              min={0}
              value={values["ai_image_cost_usd_cents"] ?? "4"}
              onChange={(e) => setValues((v) => ({ ...v, ai_image_cost_usd_cents: e.target.value }))}
              className="font-mono text-sm"
            />
            <p className="text-[10px] text-muted-foreground">
              Usado apenas para cálculo de lucratividade. Ex: 4 = $0.04
              {costCents > 0 && ` → atualmente $${(costCents / 100).toFixed(3)}/imagem`}
            </p>
          </div>
        </div>

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

      {/* ── Section 2: Model comparison table ──────────────────────────────── */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-3 bg-surface-800 border-b border-border flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">Comparativo de modelos</span>
          <span className="text-[10px] text-muted-foreground ml-auto">Clique em uma linha para selecionar</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-800/50">
              <tr>
                {["Modelo", "Tamanho", "Qualidade", "Custo USD", "Notas", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {MODEL_TABLE.map((row, i) => {
                const active = isActiveRow(row);
                return (
                  <tr
                    key={i}
                    onClick={() => setValues((v) => ({
                      ...v,
                      ai_image_model:   row.model,
                      ai_image_size:    row.size,
                      ai_image_quality: row.quality,
                    }))}
                    className={`cursor-pointer transition-colors ${
                      active
                        ? "bg-red-500/10 border-l-2 border-l-red-500"
                        : "hover:bg-surface-800/40"
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-foreground whitespace-nowrap">{row.model}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{row.size}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{row.quality}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-green-400 whitespace-nowrap">{row.usdCost}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{row.notes}</td>
                    <td className="px-4 py-3 text-center">
                      {active && <CheckCircle2 className="h-4 w-4 text-red-400 mx-auto" />}
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
            Selecionar uma linha atualiza modelo/tamanho/qualidade mas não o custo USD — ajuste manualmente conforme o modelo escolhido.
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
