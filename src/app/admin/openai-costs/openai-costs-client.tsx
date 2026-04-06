"use client";

import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw, ChevronLeft, ChevronRight,
  Loader2, AlertCircle, Info,
  Bot, Coins, Hash, ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// ── Types ─────────────────────────────────────────────────────────────────────

type Row = {
  yearMonth:    string;
  model:        string;
  displayName:  string;
  nRequests:    number;
  inputTokens:  string; // serialized BigInt
  outputTokens: string;
  costUsd:      number;
  syncedAt:     string;
  price: {
    inputPer1M:  number;
    outputPer1M: number;
    imageCents:  number | null;
  } | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTokens(raw: string): string {
  const n = Number(raw);
  if (n === 0)        return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtCost(usd: number): string {
  if (usd === 0) return "—";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}

function fmtRequests(n: number): string {
  if (n === 0) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function prevMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// ── Summary card ──────────────────────────────────────────────────────────────

function Card({ icon, label, value, sub, color = "text-foreground" }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-900 px-4 py-4 space-y-1.5">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-[11px] uppercase tracking-wider font-medium">{label}</span>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ── Model table ───────────────────────────────────────────────────────────────

function ModelTable({ rows, showMonth = false }: { rows: Row[]; showMonth?: boolean }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface-900 flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
        <Bot className="h-10 w-10 opacity-20" />
        <p className="text-sm">Nenhum dado ainda.</p>
        <p className="text-xs opacity-60">Clique em &ldquo;Sincronizar&rdquo; para buscar dados da API OpenAI.</p>
      </div>
    );
  }

  const totalRequests = rows.reduce((s, r) => s + r.nRequests, 0);
  const totalCost     = rows.reduce((s, r) => s + r.costUsd, 0);

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-surface-800 border-b border-border">
          <tr>
            {showMonth && <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Mês</th>}
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Modelo</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Chamadas</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground hidden sm:table-cell">Tokens entrada</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground hidden sm:table-cell">Tokens saída</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Custo estimado</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground hidden lg:table-cell">Preço/1M tok</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-surface-800/40 transition-colors">
              {showMonth && (
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.yearMonth}</td>
              )}
              <td className="px-4 py-3">
                <div className="flex flex-col">
                  <span className="font-medium text-foreground text-sm">{r.displayName}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{r.model}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-right font-mono text-foreground tabular-nums">
                {fmtRequests(r.nRequests)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-muted-foreground tabular-nums hidden sm:table-cell">
                {fmtTokens(r.inputTokens)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-muted-foreground tabular-nums hidden sm:table-cell">
                {fmtTokens(r.outputTokens)}
              </td>
              <td className="px-4 py-3 text-right font-mono tabular-nums">
                <span className={r.costUsd > 0.5 ? "text-amber-400" : r.costUsd > 0 ? "text-green-400" : "text-muted-foreground"}>
                  {fmtCost(r.costUsd)}
                </span>
              </td>
              <td className="px-4 py-3 text-right hidden lg:table-cell">
                {r.price ? (
                  r.price.imageCents != null ? (
                    <span className="text-xs text-muted-foreground">${(r.price.imageCents / 100).toFixed(3)}/img</span>
                  ) : (
                    <div className="text-[10px] text-muted-foreground text-right">
                      <div>in: ${r.price.inputPer1M}/1M</div>
                      <div>out: ${r.price.outputPer1M}/1M</div>
                    </div>
                  )
                ) : (
                  <span className="text-xs text-muted-foreground/40">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-surface-800/50 border-t border-border">
          <tr>
            {showMonth && <td />}
            <td className="px-4 py-2.5 text-xs font-semibold text-foreground">Total</td>
            <td className="px-4 py-2.5 text-right font-mono font-semibold text-foreground tabular-nums">
              {fmtRequests(totalRequests)}
            </td>
            <td className="px-4 py-2.5 hidden sm:table-cell" />
            <td className="px-4 py-2.5 hidden sm:table-cell" />
            <td className="px-4 py-2.5 text-right font-mono font-bold tabular-nums text-amber-400">
              {fmtCost(totalCost)}
            </td>
            <td className="px-4 py-2.5 hidden lg:table-cell" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── Year monthly breakdown ────────────────────────────────────────────────────

function MonthlyBreakdown({ rows, year }: { rows: Row[]; year: string }) {
  // Aggregate by yearMonth
  const byMonth: Record<string, { nRequests: number; costUsd: number; models: Set<string> }> = {};
  for (const r of rows) {
    const m = byMonth[r.yearMonth] ?? { nRequests: 0, costUsd: 0, models: new Set() };
    m.nRequests += r.nRequests;
    m.costUsd   += r.costUsd;
    m.models.add(r.model);
    byMonth[r.yearMonth] = m;
  }

  const months = Array.from({ length: 12 }, (_, i) =>
    `${year}-${String(i + 1).padStart(2, "0")}`,
  );

  const maxCost = Math.max(...Object.values(byMonth).map((m) => m.costUsd), 0.001);

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-surface-800">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Evolução mensal — {year}</p>
      </div>
      <table className="w-full text-sm">
        <thead className="border-b border-border/50">
          <tr>
            <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Mês</th>
            <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">Chamadas</th>
            <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">Custo estimado</th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground hidden md:table-cell pl-6">Barra</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {months.map((ym) => {
            const m = byMonth[ym];
            const pct = m ? Math.round((m.costUsd / maxCost) * 100) : 0;
            const isCurrent = ym === currentYearMonth();
            return (
              <tr key={ym} className={`hover:bg-surface-800/30 transition-colors ${isCurrent ? "bg-amber-500/5" : ""}`}>
                <td className="px-4 py-2.5">
                  <span className="text-sm text-foreground capitalize">
                    {monthLabel(ym)}
                    {isCurrent && <span className="ml-2 text-[10px] text-amber-400 font-semibold">atual</span>}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-muted-foreground tabular-nums">
                  {m ? fmtRequests(m.nRequests) : "—"}
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                  <span className={m && m.costUsd > 0 ? "text-amber-400" : "text-muted-foreground/40"}>
                    {m ? fmtCost(m.costUsd) : "—"}
                  </span>
                </td>
                <td className="px-4 py-2.5 hidden md:table-cell pl-6 w-48">
                  {m && m.costUsd > 0 ? (
                    <div className="h-1.5 rounded-full bg-surface-700 overflow-hidden w-full">
                      <div
                        className="h-full rounded-full bg-amber-500/70 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  ) : (
                    <div className="h-1.5 rounded-full bg-surface-700/30 w-full" />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function OpenAICostsClient() {
  const [view,       setView]       = useState<"month" | "year">("month");
  const [yearMonth,  setYearMonth]  = useState(currentYearMonth);
  const [year,       setYear]       = useState(String(new Date().getFullYear()));
  const [rows,       setRows]       = useState<Row[]>([]);
  const [lastSync,   setLastSync]   = useState<string | null>(null);
  const [loading,         setLoading]         = useState(false);
  const [syncing,         setSyncing]         = useState(false);
  const [syncingInternal, setSyncingInternal] = useState(false);
  const [syncErrors,      setSyncErrors]      = useState<string[]>([]);

  const currentYM = currentYearMonth();
  const isCurrentMonth = yearMonth === currentYM;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params =
        view === "year"
          ? `view=year&year=${year}`
          : `view=month&yearMonth=${yearMonth}`;
      const res = await fetch(`/api/admin/openai-costs?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setRows(data.rows ?? []);
      setLastSync(data.lastSyncedAt);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [view, yearMonth, year]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleSync() {
    setSyncing(true);
    setSyncErrors([]);
    try {
      const yearMonths =
        view === "year"
          ? Array.from({ length: 12 }, (_, i) =>
              `${year}-${String(i + 1).padStart(2, "0")}`,
            )
          : [yearMonth];

      const res = await fetch("/api/admin/openai-costs/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yearMonths }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSyncErrors([data.error ?? "Erro ao sincronizar"]);
        return;
      }
      if (data.errors?.length) setSyncErrors(data.errors);
      await loadData();
    } catch (err) {
      setSyncErrors([(err as Error).message]);
    } finally {
      setSyncing(false);
    }
  }

  async function handleSyncInternal() {
    setSyncingInternal(true);
    setSyncErrors([]);
    try {
      const yearMonths =
        view === "year"
          ? Array.from({ length: 12 }, (_, i) =>
              `${year}-${String(i + 1).padStart(2, "0")}`,
            )
          : [yearMonth];

      const res = await fetch("/api/admin/openai-costs/sync-internal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yearMonths }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSyncErrors([data.error ?? "Erro ao estimar custos internos"]);
        return;
      }
      await loadData();
    } catch (err) {
      setSyncErrors([(err as Error).message]);
    } finally {
      setSyncingInternal(false);
    }
  }

  // Summaries
  const totalRequests = rows.reduce((s, r) => s + r.nRequests, 0);
  const totalCost     = rows.reduce((s, r) => s + r.costUsd, 0);
  const totalInTok    = rows.reduce((s, r) => s + Number(r.inputTokens),  0);
  const totalOutTok   = rows.reduce((s, r) => s + Number(r.outputTokens), 0);
  const modelsCount   = new Set(rows.map((r) => r.model)).size;

  const lastSyncLabel = lastSync
    ? new Date(lastSync).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : null;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Bot className="h-5 w-5 text-purple-400" />
            Custos OpenAI
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Consumo real por modelo · preços estimados com base na tabela OpenAI
          </p>
        </div>

        <div className="flex items-center gap-2">
          {lastSyncLabel && (
            <span className="text-[11px] text-muted-foreground">
              Sync: {lastSyncLabel}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={handleSyncInternal}
            disabled={syncingInternal || syncing}
          >
            {syncingInternal
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Bot className="h-3.5 w-3.5" />}
            {syncingInternal ? "Estimando..." : "Logs internos"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={handleSync}
            disabled={syncing || syncingInternal}
          >
            {syncing
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <RefreshCw className="h-3.5 w-3.5" />}
            {syncing ? "Sincronizando..." : "Sincronizar"}
          </Button>
        </div>
      </div>

      {/* ── Info banner ── */}
      <div className="flex items-start gap-2.5 rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-xs text-blue-300">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-400" />
        <span>
          <strong>Sincronizar</strong> busca tokens reais da <strong>API OpenAI</strong>{" "}
          (requer <code className="font-mono">OPENAI_ADMIN_API_KEY</code> com acesso de organização).{" "}
          <strong>Logs internos</strong> estima o custo a partir dos registros de{" "}
          <code className="font-mono">AiCallLog</code> salvos no banco — útil quando a chave
          não tem permissão de uso.
        </span>
      </div>

      {/* ── Sync errors ── */}
      {syncErrors.length > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 space-y-1">
          <div className="flex items-center gap-2 text-red-400 text-xs font-semibold">
            <AlertCircle className="h-3.5 w-3.5" />
            Erros ao sincronizar
          </div>
          {syncErrors.map((e, i) => (
            <p key={i} className="text-xs text-red-300 font-mono pl-5">{e}</p>
          ))}
        </div>
      )}

      {/* ── Tabs: Mês / Ano ── */}
      <Tabs value={view} onValueChange={(v) => setView(v as "month" | "year")}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="month">Por mês</TabsTrigger>
            <TabsTrigger value="year">Por ano</TabsTrigger>
          </TabsList>

          {/* Period navigator */}
          {view === "month" ? (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" onClick={() => setYearMonth(prevMonth(yearMonth))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium text-foreground w-40 text-center capitalize">
                {monthLabel(yearMonth)}
                {isCurrentMonth && <span className="ml-1.5 text-[10px] text-amber-400">atual</span>}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setYearMonth(nextMonth(yearMonth))}
                disabled={yearMonth >= currentYM}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" onClick={() => setYear(String(Number(year) - 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium text-foreground w-20 text-center">{year}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setYear(String(Number(year) + 1))}
                disabled={Number(year) >= new Date().getFullYear()}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* ── Summary cards ── */}
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Carregando...</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              <Card
                icon={<Hash className="h-3.5 w-3.5" />}
                label="Chamadas"
                value={fmtRequests(totalRequests) === "—" ? "0" : fmtRequests(totalRequests)}
                sub={`${modelsCount} modelo${modelsCount !== 1 ? "s" : ""}`}
              />
              <Card
                icon={<ArrowUpDown className="h-3.5 w-3.5" />}
                label="Tokens entrada"
                value={fmtTokens(String(totalInTok)) === "—" ? "0" : fmtTokens(String(totalInTok))}
                sub="input tokens"
              />
              <Card
                icon={<ArrowUpDown className="h-3.5 w-3.5" />}
                label="Tokens saída"
                value={fmtTokens(String(totalOutTok)) === "—" ? "0" : fmtTokens(String(totalOutTok))}
                sub="output tokens"
              />
              <Card
                icon={<Coins className="h-3.5 w-3.5" />}
                label="Custo estimado"
                value={totalCost > 0 ? `$${totalCost.toFixed(3)}` : "$0.00"}
                sub="USD · preços OpenAI"
                color={totalCost > 5 ? "text-amber-400" : "text-foreground"}
              />
            </div>

            {/* ── Month view ── */}
            <TabsContent value="month" className="mt-4">
              <ModelTable rows={rows} />
            </TabsContent>

            {/* ── Year view ── */}
            <TabsContent value="year" className="mt-4 space-y-5">
              <MonthlyBreakdown rows={rows} year={year} />

              {rows.length > 0 && (
                <>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">Breakdown por modelo — {year}</p>
                  </div>
                  <ModelTable rows={aggregateByModel(rows)} />
                </>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}

// ── Aggregation helper (year view → collapse months into models) ──────────────

function aggregateByModel(rows: Row[]): Row[] {
  const map: Record<string, Row> = {};
  for (const r of rows) {
    const k = map[r.model];
    if (!k) {
      map[r.model] = { ...r, inputTokens: r.inputTokens, outputTokens: r.outputTokens };
    } else {
      k.nRequests    += r.nRequests;
      k.costUsd      += r.costUsd;
      k.inputTokens  = String(BigInt(k.inputTokens)  + BigInt(r.inputTokens));
      k.outputTokens = String(BigInt(k.outputTokens) + BigInt(r.outputTokens));
    }
  }
  return Object.values(map).sort((a, b) => b.costUsd - a.costUsd);
}
