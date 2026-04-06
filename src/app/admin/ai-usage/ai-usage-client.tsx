"use client";

import { useState } from "react";
import {
  Brain, ChevronDown, ChevronRight, Loader2,
  TrendingUp, DollarSign, Zap, Image, MessageSquare, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Types ─────────────────────────────────────────────────────────────────────

type Row = {
  barbershopId:       string;
  barbershopName:     string;
  yearMonth:          string;  // "2026-04" or "trialing"
  usageCount:         number;
  planTier:           string;
  planStatus:         string;  // TRIALING | ACTIVE | INACTIVE | PAST_DUE
  planLimit:          number;  // 9999 = ∞
  trialCap:           number;  // 300
  aiCreditBalance:    number;  // remaining
  aiCreditsPurchased: number;  // total ever purchased
};

type FeatureRow   = { feature: string; label: string; count: number; totalCostUsdCents: number };
type LogEntry     = { id: string; feature: string; label: string; costUsdCents: number; createdAt: string };
type MonthEntry   = { yearMonth: string; usageCount: number };

type DetailData = {
  barbershop:    { id: string; name: string; planTier: string; aiCreditBalance: number };
  currentMonth:  { yearMonth: string; usageCount: number; limit: number | null };
  months:        MonthEntry[];
  byFeature:     FeatureRow[];
  recentLogs:    LogEntry[];
  totalCostUsdCents: number;
  logsAvailable: number;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const PLAN_COLOR: Record<string, string> = {
  FREE: "text-zinc-400", STARTER: "text-blue-400", PRO: "text-gold-400", ENTERPRISE: "text-purple-400",
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  TRIALING:  { label: "Trial",    cls: "bg-blue-500/15 text-blue-400 border-blue-500/30"   },
  ACTIVE:    { label: "Ativo",    cls: "bg-green-500/15 text-green-400 border-green-500/30" },
  INACTIVE:  { label: "Inativo",  cls: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30"   },
  PAST_DUE:  { label: "Atrasado", cls: "bg-red-500/15 text-red-400 border-red-500/30"       },
  CANCELLED: { label: "Cancelado",cls: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30"   },
};

const FEATURE_ICON: Record<string, React.ReactElement> = {
  campaign_image: <Image     className="h-3 w-3" />,
  campaign_text:  <Sparkles  className="h-3 w-3" />,
  copilot_chat:   <MessageSquare className="h-3 w-3" />,
  theme_suggest:  <Zap       className="h-3 w-3" />,
};

function featureIcon(f: string) { return FEATURE_ICON[f] ?? <Zap className="h-3 w-3" />; }

// ── Segmented usage bar ───────────────────────────────────────────────────────

function SegmentedBar({ row }: { row: Row }) {
  const isTrial = row.yearMonth === "trialing" || row.planStatus === "TRIALING";
  // aiCreditsPurchased may be 0 if credits were added directly to balance;
  // fall back to aiCreditBalance as the "total" in that case.
  const effectivePurchased = row.aiCreditsPurchased > 0 ? row.aiCreditsPurchased : row.aiCreditBalance;

  if (isTrial) {
    const pct   = Math.min((row.usageCount / row.trialCap) * 100, 100);
    const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-yellow-500" : "bg-blue-400";
    return (
      <div className="space-y-1 min-w-44">
        <div className="h-1.5 rounded-full bg-surface-700 overflow-hidden flex">
          <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
          {/* Reserved credits shown as purple segment after the trial bar */}
          {row.aiCreditBalance > 0 && (
            <div
              className="h-full bg-purple-400/40 transition-all"
              style={{ width: `${Math.min((row.aiCreditBalance / (row.trialCap + effectivePurchased)) * 100, 100 - pct)}%` }}
            />
          )}
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">{row.usageCount} / {row.trialCap} trial</span>
          {row.aiCreditBalance > 0 && (
            <span className="text-purple-400/80" title="Créditos comprados — usáveis após o trial">
              +{row.aiCreditBalance} reservados
            </span>
          )}
        </div>
      </div>
    );
  }

  const planUsed        = Math.min(row.usageCount, row.planLimit === 9999 ? row.usageCount : row.planLimit);
  const extrasUsed      = Math.max(0, row.usageCount - (row.planLimit === 9999 ? Infinity : row.planLimit));
  const extrasRemaining = row.aiCreditBalance;
  const totalCap        = (row.planLimit === 9999 ? row.usageCount + 1 : row.planLimit) + effectivePurchased;

  const pctPlan   = totalCap > 0 ? (planUsed       / totalCap) * 100 : 0;
  const pctUsed   = totalCap > 0 ? (extrasUsed     / totalCap) * 100 : 0;
  const pctRemain = totalCap > 0 ? (extrasRemaining / totalCap) * 100 : 0;
  const totalUsed = totalCap > 0 ? (row.usageCount  / totalCap) * 100 : 0;

  const overPlan = row.planLimit !== 9999 && row.usageCount > row.planLimit;

  return (
    <div className="space-y-1 min-w-44">
      <div className="h-1.5 rounded-full bg-surface-700 overflow-hidden flex">
        <div
          className={`h-full ${overPlan ? "bg-green-500" : totalUsed >= 90 ? "bg-red-500" : totalUsed >= 70 ? "bg-yellow-500" : "bg-green-500"} transition-all`}
          style={{ width: `${pctPlan}%` }}
        />
        {extrasUsed > 0 && (
          <div className="h-full bg-purple-500 transition-all" style={{ width: `${pctUsed}%` }} />
        )}
        {extrasRemaining > 0 && (
          <div className="h-full bg-purple-400/30 transition-all" style={{ width: `${pctRemain}%` }} />
        )}
      </div>
      <div className="flex justify-between text-[10px]">
        <span className="text-muted-foreground">
          {planUsed}/{row.planLimit === 9999 ? "∞" : row.planLimit} plano
          {extrasUsed > 0 && <span className="text-purple-400 ml-1">+{extrasUsed} extra</span>}
        </span>
        {effectivePurchased > 0 && (
          <span className={extrasRemaining > 0 ? "text-purple-400" : "text-muted-foreground/50"}>
            {extrasRemaining}/{effectivePurchased} restam
          </span>
        )}
      </div>
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({ barbershopId, yearMonth }: { barbershopId: string; yearMonth: string }) {
  const [data,        setData]        = useState<DetailData | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [loaded,      setLoaded]      = useState(false);
  const [showAllLogs, setShowAllLogs] = useState(false);

  async function load() {
    if (loaded) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ai-usage/${barbershopId}?yearMonth=${yearMonth}`);
      setData(await res.json());
      setLoaded(true);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  if (!loaded && !loading) load();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Carregando extrato...</span>
      </div>
    );
  }

  if (!data) return null;

  const logsToShow = showAllLogs ? data.recentLogs : data.recentLogs.slice(0, 10);

  return (
    <div className="px-6 py-5 bg-surface-900/50 border-t border-border space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          icon={<Zap className="h-4 w-4 text-purple-400" />}
          label="Calls este mês"
          value={String(data.currentMonth.usageCount)}
          sub={data.currentMonth.limit ? `de ${data.currentMonth.limit}` : "ilimitado"}
        />
        <SummaryCard
          icon={<DollarSign className="h-4 w-4 text-green-400" />}
          label="Custo estimado"
          value={`$${(data.totalCostUsdCents / 100).toFixed(3)}`}
          sub="últimas 50 calls"
        />
        <SummaryCard
          icon={<TrendingUp className="h-4 w-4 text-blue-400" />}
          label="Créditos restantes"
          value={data.barbershop.aiCreditBalance > 0 ? `+${data.barbershop.aiCreditBalance}` : "—"}
          sub="compra avulsa"
        />
        <SummaryCard
          icon={<Brain className="h-4 w-4 text-amber-400" />}
          label="Plano"
          value={data.barbershop.planTier}
          sub={`${data.months.length} meses registrados`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Feature breakdown */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Uso por feature (últimas 50 calls)</p>
          {data.byFeature.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3">Nenhum log disponível.</p>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-surface-800/60">
                  <tr>
                    <th className="px-3 py-2 text-left text-muted-foreground font-medium">Feature</th>
                    <th className="px-3 py-2 text-right text-muted-foreground font-medium">Calls</th>
                    <th className="px-3 py-2 text-right text-muted-foreground font-medium">Custo USD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {data.byFeature.map((f) => (
                    <tr key={f.feature} className="hover:bg-surface-800/30">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5 text-foreground">
                          <span className="text-muted-foreground">{featureIcon(f.feature)}</span>
                          {f.label}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-foreground">{f.count}</td>
                      <td className="px-3 py-2 text-right font-mono text-amber-400">
                        {f.totalCostUsdCents > 0 ? `$${(f.totalCostUsdCents / 100).toFixed(3)}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Monthly history */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Histórico mensal</p>
          {data.months.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3">Nenhum histórico.</p>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-surface-800/60">
                  <tr>
                    <th className="px-3 py-2 text-left text-muted-foreground font-medium">Mês</th>
                    <th className="px-3 py-2 text-right text-muted-foreground font-medium">Calls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {data.months.map((m) => (
                    <tr key={m.yearMonth} className={`hover:bg-surface-800/30 ${m.yearMonth === yearMonth ? "bg-purple-500/5" : ""}`}>
                      <td className="px-3 py-2 text-foreground font-mono">
                        {m.yearMonth === "trial" || m.yearMonth === "trialing" ? "Trial" : m.yearMonth}
                        {m.yearMonth === yearMonth && <span className="ml-1.5 text-[10px] text-purple-400">atual</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-foreground">{m.usageCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Recent call log */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Log de calls recentes
          <span className="ml-1.5 normal-case font-normal text-muted-foreground/60">(mantidos os últimos {data.logsAvailable})</span>
        </p>
        {data.recentLogs.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3">Nenhum log disponível.</p>
        ) : (
          <>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-surface-800/60">
                  <tr>
                    <th className="px-3 py-2 text-left text-muted-foreground font-medium">Feature</th>
                    <th className="px-3 py-2 text-left text-muted-foreground font-medium">Descrição</th>
                    <th className="px-3 py-2 text-right text-muted-foreground font-medium">Custo</th>
                    <th className="px-3 py-2 text-right text-muted-foreground font-medium">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {logsToShow.map((l) => (
                    <tr key={l.id} className="hover:bg-surface-800/30">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          {featureIcon(l.feature)}
                          <span className="font-mono text-[10px]">{l.feature}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-foreground/80">{l.label}</td>
                      <td className="px-3 py-2 text-right font-mono text-amber-400">
                        {l.costUsdCents > 0 ? `$${(l.costUsdCents / 100).toFixed(3)}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground font-mono whitespace-nowrap">
                        {new Date(l.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.recentLogs.length > 10 && (
              <button onClick={() => setShowAllLogs(!showAllLogs)} className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
                {showAllLogs ? "Mostrar menos" : `Ver mais ${data.recentLogs.length - 10} calls`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value, sub }: { icon: React.ReactElement; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-800/60 px-4 py-3 space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <p className="text-[10px] uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-lg font-bold text-foreground tabular-nums">{value}</p>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AiUsageClient({ data, yearMonth }: { data: Row[]; yearMonth: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAll,  setShowAll]  = useState(false);

  const total       = data.reduce((s, r) => s + r.usageCount, 0);
  const visibleData = showAll ? data : data.slice(0, 10);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Uso de IA</h1>
          <p className="text-sm text-muted-foreground">{yearMonth} · {total} calls totais na plataforma</p>
        </div>
        <p className="text-xs text-muted-foreground">{data.length} barbearias ativas</p>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-1.5 rounded-full bg-green-500" />Créditos do plano</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-1.5 rounded-full bg-purple-500" />Extras usados</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-1.5 rounded-full bg-purple-400/30" />Extras restantes</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-1.5 rounded-full bg-blue-400" />Trial</span>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-800 border-b border-border">
            <tr>
              {["", "Barbearia", "Plano", "Uso", "Extras comprados"].map((h, i) => (
                <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibleData.map((r) => {
              const isExpanded = expanded === r.barbershopId;
              const badge      = STATUS_BADGE[r.planStatus] ?? STATUS_BADGE["ACTIVE"];
              return (
                <>
                  <tr
                    key={r.barbershopId}
                    className={`cursor-pointer transition-colors ${isExpanded ? "bg-surface-800/60" : "hover:bg-surface-800/40"}`}
                    onClick={() => setExpanded(isExpanded ? null : r.barbershopId)}
                  >
                    <td className="pl-4 py-3 w-6">
                      {isExpanded
                        ? <ChevronDown  className="h-3.5 w-3.5 text-muted-foreground" />
                        : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Brain className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div>
                          <span className="font-medium text-foreground">{r.barbershopName}</span>
                          <span className={`ml-2 inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold ${PLAN_COLOR[r.planTier]}`}>{r.planTier}</span>
                    </td>
                    <td className="px-4 py-3">
                      <SegmentedBar row={r} />
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {(r.aiCreditsPurchased > 0 || r.aiCreditBalance > 0) ? (
                        <div>
                          <span className="text-purple-400 font-semibold">{r.aiCreditBalance}</span>
                          {r.aiCreditsPurchased > 0 && (
                            <span className="text-muted-foreground text-xs"> / {r.aiCreditsPurchased}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${r.barbershopId}-detail`}>
                      <td colSpan={5} className="p-0">
                        <DetailPanel barbershopId={r.barbershopId} yearMonth={yearMonth} />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {data.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">Nenhum uso registrado este mês.</td></tr>
            )}
          </tbody>
        </table>

        {data.length > 10 && (
          <div className="px-4 py-3 border-t border-border bg-surface-800/30 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {showAll ? `Mostrando todas ${data.length}` : `Mostrando top 10 de ${data.length}`}
            </p>
            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1.5" onClick={() => setShowAll(!showAll)}>
              {showAll ? "Mostrar menos" : `Ver mais ${data.length - 10} barbearias`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
