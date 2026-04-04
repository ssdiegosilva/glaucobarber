"use client";

import { useState } from "react";
import { Brain, ChevronDown, ChevronRight, Loader2, TrendingUp, DollarSign, Zap, Image, MessageSquare, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type Row = {
  barbershopId: string;
  barbershopName: string;
  yearMonth: string;
  usageCount: number;
  planTier: string;
  limit: number;
  aiCredits: number;
};

type FeatureRow = {
  feature: string;
  label: string;
  count: number;
  totalCostUsdCents: number;
};

type LogEntry = {
  id: string;
  feature: string;
  label: string;
  costUsdCents: number;
  createdAt: string;
};

type MonthEntry = {
  yearMonth: string;
  usageCount: number;
};

type DetailData = {
  barbershop: { id: string; name: string; planTier: string; aiCreditBalance: number };
  currentMonth: { yearMonth: string; usageCount: number; limit: number | null };
  months: MonthEntry[];
  byFeature: FeatureRow[];
  recentLogs: LogEntry[];
  totalCostUsdCents: number;
  logsAvailable: number;
};

const PLAN_COLOR: Record<string, string> = {
  FREE: "text-zinc-400", STARTER: "text-blue-400", PRO: "text-gold-400", ENTERPRISE: "text-purple-400",
};

const FEATURE_ICON: Record<string, React.ReactElement> = {
  campaign_image:  <Image className="h-3 w-3" />,
  campaign_text:   <Sparkles className="h-3 w-3" />,
  copilot_chat:    <MessageSquare className="h-3 w-3" />,
  theme_suggest:   <Zap className="h-3 w-3" />,
};

function featureIcon(feature: string) {
  return FEATURE_ICON[feature] ?? <Zap className="h-3 w-3" />;
}

function UsageBar({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min((used / limit) * 100, 100);
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-yellow-500" : "bg-green-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-surface-700 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-16 text-right">{used}/{limit === 9999 ? "∞" : limit}</span>
    </div>
  );
}

function DetailPanel({ barbershopId, yearMonth }: { barbershopId: string; yearMonth: string }) {
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showAllLogs, setShowAllLogs] = useState(false);

  async function load() {
    if (loaded) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ai-usage/${barbershopId}?yearMonth=${yearMonth}`);
      const d = await res.json();
      setData(d);
      setLoaded(true);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  // auto-load on first render
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
          label="Créditos extras"
          value={data.barbershop.aiCreditBalance > 0 ? `+${data.barbershop.aiCreditBalance}` : "—"}
          sub="não expiram"
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
                        {m.yearMonth === "trial" ? "Trial" : m.yearMonth}
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
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Log de calls recentes
            <span className="ml-1.5 normal-case font-normal text-muted-foreground/60">(mantidos os últimos {data.logsAvailable})</span>
          </p>
        </div>
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
              <button
                onClick={() => setShowAllLogs(!showAllLogs)}
                className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
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

export function AiUsageClient({ data, yearMonth }: { data: Row[]; yearMonth: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const total = data.reduce((s, r) => s + r.usageCount, 0);
  const visibleData = showAll ? data : data.slice(0, 10);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Uso de IA</h1>
          <p className="text-sm text-muted-foreground">{yearMonth} · {total} calls totais na plataforma</p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground">{data.length} barbearias ativas</p>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-800 border-b border-border">
            <tr>
              {["", "Barbearia", "Plano", "Uso / Limite", "Créditos extras", "% usado"].map((h, i) => (
                <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibleData.map((r) => {
              const pct = r.limit === 9999 ? 0 : Math.min(Math.round((r.usageCount / r.limit) * 100), 100);
              const isExpanded = expanded === r.barbershopId;
              return (
                <>
                  <tr
                    key={r.barbershopId}
                    className={`cursor-pointer transition-colors ${isExpanded ? "bg-surface-800/60" : "hover:bg-surface-800/40"}`}
                    onClick={() => setExpanded(isExpanded ? null : r.barbershopId)}
                  >
                    <td className="pl-4 py-3 w-6">
                      {isExpanded
                        ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      }
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Brain className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium text-foreground">{r.barbershopName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold ${PLAN_COLOR[r.planTier]}`}>{r.planTier}</span>
                    </td>
                    <td className="px-4 py-3 min-w-40">
                      <UsageBar used={r.usageCount} limit={r.limit} />
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">{r.aiCredits > 0 ? `+${r.aiCredits}` : "—"}</td>
                    <td className="px-4 py-3">
                      {r.limit === 9999 ? (
                        <span className="text-sm text-muted-foreground">∞</span>
                      ) : (
                        <span className={`text-sm font-semibold ${pct >= 90 ? "text-red-400" : pct >= 70 ? "text-yellow-400" : "text-green-400"}`}>
                          {pct}%
                        </span>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${r.barbershopId}-detail`}>
                      <td colSpan={6} className="p-0">
                        <DetailPanel barbershopId={r.barbershopId} yearMonth={yearMonth} />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {data.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">Nenhum uso registrado este mês.</td></tr>
            )}
          </tbody>
        </table>

        {data.length > 10 && (
          <div className="px-4 py-3 border-t border-border bg-surface-800/30 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {showAll ? `Mostrando todas ${data.length}` : `Mostrando top 10 de ${data.length}`}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 gap-1.5"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? "Mostrar menos" : `Ver mais ${data.length - 10} barbearias`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
