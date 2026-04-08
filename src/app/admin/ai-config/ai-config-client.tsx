"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, Cpu, BarChart3, Lightbulb, Loader2, ImageOff, AlertTriangle, TrendingUp } from "lucide-react";

const TIER_LABELS: Record<string, string> = { low: "Rascunho", medium: "Padrão", high: "Alta qualidade" };
const CREDIT_KEYS: Record<string, string> = {
  low: "ai_image_credit_cost_low", medium: "ai_image_credit_cost_medium", high: "ai_image_credit_cost_high",
};
const OPENAI_COST_KEYS: Record<string, string> = {
  low: "ai_image_openai_cost_low", medium: "ai_image_openai_cost_medium", high: "ai_image_openai_cost_high",
};

// Custo real por tier/modelo — referência somente visual na tabela
const COST_BY_MODEL: Record<string, { low: number; medium: number; high: number }> = {
  "gpt-image-1": { low: 4, medium: 7,  high: 19 },
  "dall-e-3":    { low: 4, medium: 4,  high: 8  }, // standard=low/medium, hd=high
  "dall-e-2":    { low: 2, medium: 2,  high: 2  }, // always standard
};

const MODEL_OPTIONS = ["gpt-image-1", "dall-e-3", "dall-e-2"] as const;

interface CostData {
  trialStats: {
    count:             number;
    totalCostUsdCents: number;
    avgCostUsdCents:   number;
  };
  planBreakdown: {
    tier:                  string;
    shopCount:             number;
    activeSubs:            number;
    trialingSubs:          number;
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
            {activeModel} · 1024×1024
          </span>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Modelo</label>
          <select
            value={values["ai_image_model"] ?? "gpt-image-1"}
            onChange={(e) => setValues((v) => ({ ...v, ai_image_model: e.target.value }))}
            className="w-full rounded-md border border-border bg-surface-900 px-3 py-2 text-sm text-foreground sm:max-w-xs"
          >
            {MODEL_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <p className="text-[10px] text-muted-foreground">
            {activeModel === "gpt-image-1" ? "Suporta foto de referência (images.edit)" : "Geração sem referência"} · Tamanho fixo 1024×1024 (Instagram quadrado)
          </p>
        </div>

        {/* OpenAI costs per tier */}
        <div className="space-y-2 pt-1 border-t border-border/40">
          <div className="flex items-center gap-2">
            <Cpu className="h-3.5 w-3.5 text-amber-400" />
            <p className="text-xs font-semibold text-foreground">Custo OpenAI por tier (USD)</p>
            <span className="text-[10px] text-muted-foreground ml-auto">gpt-image-1 · 1024×1024 · atualize quando a OpenAI mudar o preço</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(["low", "medium", "high"] as const).map((tier) => {
              const key = `ai_image_openai_cost_${tier}`;
              const defaults: Record<string, string> = { low: "0.040", medium: "0.070", high: "0.190" };
              const labels: Record<string, string> = { low: "Rascunho", medium: "Padrão", high: "Alta qualidade" };
              const colors: Record<string, string> = { low: "text-green-400", medium: "text-amber-400", high: "text-red-400" };
              return (
                <div key={tier} className="space-y-1.5">
                  <label className={`text-xs font-medium ${colors[tier]}`}>{labels[tier]}</label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">$</span>
                    <Input
                      type="number"
                      min={0.001}
                      step={0.001}
                      value={values[key] ?? defaults[tier]}
                      onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Profit margin */}
        <div className="space-y-2 pt-1 border-t border-border/40">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5 text-green-400" />
            <p className="text-xs font-semibold text-foreground">Margem de lucro sobre preço de venda</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={35}
                max={90}
                step={1}
                value={values["ai_image_profit_margin"] ?? "35"}
                onChange={(e) => {
                  const v = Math.max(35, Math.min(90, parseInt(e.target.value) || 35));
                  setValues((prev) => ({ ...prev, ai_image_profit_margin: String(v) }));
                }}
                className="font-mono text-sm w-24"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Mínimo 35% · Máximo 90% · O cron diário usa esse valor para calcular créditos automaticamente
            </p>
          </div>
          {/* Preview with current margin + configured OpenAI costs */}
          {(() => {
            const margin = Math.max(35, parseInt(values["ai_image_profit_margin"] ?? "35") || 35) / 100;
            const usdBrl = 5.80; // approximate — cron uses live rate
            const openaiCosts = {
              low:    parseFloat(values["ai_image_openai_cost_low"]    ?? "0.040") || 0.040,
              medium: parseFloat(values["ai_image_openai_cost_medium"] ?? "0.070") || 0.070,
              high:   parseFloat(values["ai_image_openai_cost_high"]   ?? "0.190") || 0.190,
            };
            const calc = (usd: number) => Math.ceil((usd * usdBrl) / (0.10 * (1 - margin)));
            return (
              <div className="rounded-md bg-surface-900/60 border border-border/40 px-3 py-2 flex flex-wrap gap-4 text-[11px]">
                <span className="text-muted-foreground">Prévia (USD/BRL ≈ R$5,80):</span>
                <span className="text-green-400">Rascunho: <b>{calc(openaiCosts.low)} cred.</b></span>
                <span className="text-amber-400">Padrão: <b>{calc(openaiCosts.medium)} cred.</b></span>
                <span className="text-red-400">Alta: <b>{calc(openaiCosts.high)} cred.</b></span>
              </div>
            );
          })()}
        </div>

        {/* Credit costs per quality tier */}
        <div className="space-y-2 pt-1 border-t border-border/40">
          <p className="text-xs font-semibold text-muted-foreground">Créditos cobrados por tier de qualidade <span className="font-normal">(sobrescreve o cron — edite só para ajuste manual)</span></p>
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
          Custo OpenAI para <span className="font-mono">{activeModel}</span> 1024×1024 — Rascunho ${(modelCosts.low / 100).toFixed(3)} · Padrão ${(modelCosts.medium / 100).toFixed(3)} · Alta ${(modelCosts.high / 100).toFixed(3)}
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
      {(() => {
        const APPROX_USD_BRL = 5.80;
        const CREDIT_BRL     = 0.10;
        const margin = Math.max(35, Math.min(90, parseInt(values["ai_image_profit_margin"] ?? "35") || 35)) / 100;

        const tiers = (["low", "medium", "high"] as const).map((tier) => {
          const defaults: Record<string, number> = { low: 0.040, medium: 0.070, high: 0.190 };
          const costUsd   = parseFloat(values[OPENAI_COST_KEYS[tier]] ?? "") || defaults[tier];
          const breakEven = Math.ceil((costUsd * APPROX_USD_BRL) / CREDIT_BRL);
          const atMargin  = Math.ceil((costUsd * APPROX_USD_BRL) / (CREDIT_BRL * (1 - margin)));
          const at80      = Math.ceil((costUsd * APPROX_USD_BRL) / (CREDIT_BRL * 0.20));
          const configured = parseInt(values[CREDIT_KEYS[tier]] ?? "") || atMargin;
          const realMargin = configured > 0
            ? Math.round(((configured * CREDIT_BRL - costUsd * APPROX_USD_BRL) / (configured * CREDIT_BRL)) * 100)
            : 0;
          return { tier, costUsd, breakEven, atMargin, at80, configured, realMargin };
        });

        return (
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="px-4 py-3 bg-surface-800 border-b border-border flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">Referência por tier</span>
              <span className="text-[10px] text-muted-foreground ml-auto">
                <span className="font-mono">{activeModel}</span> · 1024×1024 — USD/BRL ≈ R$5,80 (referência)
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-800/50">
                  <tr>
                    {["Tier", "Custo OpenAI", "Break-even", `${Math.round(margin * 100)}% margem`, "80% margem", "Configurado", "Margem real"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {tiers.map((row) => (
                    <tr key={row.tier} className="hover:bg-surface-800/40 transition-colors">
                      <td className="px-4 py-3 text-xs font-semibold text-foreground">{TIER_LABELS[row.tier]}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-amber-400 whitespace-nowrap">${row.costUsd.toFixed(3)}</td>
                      <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">{row.breakEven} cred.</td>
                      <td className="px-4 py-3 text-xs font-semibold text-blue-400 whitespace-nowrap">{row.atMargin} cred.</td>
                      <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">{row.at80} cred.</td>
                      <td className="px-4 py-3 text-xs font-bold text-foreground whitespace-nowrap">{row.configured} cred.</td>
                      <td className="px-4 py-3 text-xs font-semibold whitespace-nowrap">
                        <span className={row.realMargin >= 35 ? "text-green-400" : "text-red-400"}>
                          {row.realMargin}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 bg-surface-800/30 border-t border-border/40">
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Lightbulb className="h-3 w-3 text-amber-400 shrink-0" />
                Break-even = créditos mínimos para cobrir o custo (0% margem). Margem real = (receita − custo) ÷ receita, usando USD/BRL ≈ R$5,80 e 1 crédito = R$0,10.
              </p>
            </div>
          </div>
        );
      })()}

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
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Por plano (todos)</p>
              {costData.planBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Nenhuma barbearia cadastrada.</p>
              ) : (
                <>
                  <div className="rounded-md border border-border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-surface-800/50">
                        <tr>
                          {["Plano", "Total", "Ativos", "Trial", "Uso IA", "Custo est.", "Receita"].map((h) => (
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
                            <td className="px-4 py-2 text-xs text-green-400">{row.activeSubs || "—"}</td>
                            <td className="px-4 py-2 text-xs text-amber-400">{row.trialingSubs || "—"}</td>
                            <td className="px-4 py-2 text-xs text-muted-foreground">{row.totalUsage}</td>
                            <td className="px-4 py-2 text-xs text-amber-400 font-medium">
                              ${(row.estimatedCostUsdCents / 100).toFixed(2)}
                            </td>
                            <td className="px-4 py-2 text-xs text-green-400 font-medium">
                              {row.planRevenueCents > 0
                                ? `R$${(row.planRevenueCents / 100).toFixed(0)}`
                                : <span className="text-muted-foreground">—</span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    Receita = R$49,90 × barbearias ativas (não trial). Trial não gera receita.
                  </p>
                </>
              )}
            </div>

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
