"use client";

import { useState } from "react";
import {
  Zap, MessageCircle, RefreshCw, UserPlus,
  Clock, AlertTriangle, CheckCircle, XCircle,
  Brain, Users, TrendingUp, BarChart3, Timer, Play, Loader2, ImageOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

type KillSwitches = {
  kill_ai_global:        boolean;
  kill_image_generation: boolean;
  kill_whatsapp_auto:    boolean;
  kill_trinks_sync:      boolean;
  kill_new_signups:      boolean;
  kill_image_pricing:    boolean;
};

type CronRun = {
  name:       string;
  status:     string | null;
  ranAt:      string | null;
  durationMs: number | null;
  error:      string | null;
  isLate:     boolean;
};

type Queues = {
  waQueued:            number;
  waFailed:            number;
  campaignsScheduled:  number;
  syncFailures: {
    id:             string;
    barbershopName: string;
    status:         string;
    errorsCount:    number;
    startedAt:      string;
  }[];
};

type Metrics = {
  totalShops:   number;
  trialing:     number;
  aiToday:      number;
  aiThisMonth:  number;
  trialsExpiringSoon: { barbershopId: string; barbershopName: string; trialEndsAt: string }[];
  nearLimit:    { barbershopId: string; barbershopName: string; usageCount: number; limit: number }[];
};

type ImagePricing = {
  usdBrl:     number | null;
  rateSource: string | null;
  updatedAt:  string | null;
  credits:    { low: number; medium: number; high: number } | null;
};

interface Props {
  killSwitches:  KillSwitches;
  cronRuns:      CronRun[];
  queues:        Queues;
  metrics:       Metrics;
  imagePricing:  ImagePricing;
}

const KILL_SWITCH_META: {
  key: keyof KillSwitches;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}[] = [
  {
    key: "kill_ai_global",
    label: "IA Global",
    description: "Pausa toda geração de IA para todas as barbearias",
    icon: Brain,
    color: "purple",
  },
  {
    key: "kill_image_generation",
    label: "Geração de Imagens",
    description: "Bloqueia campanhas e Criar Visual (economia de emergência)",
    icon: ImageOff,
    color: "orange",
  },
  {
    key: "kill_whatsapp_auto",
    label: "WhatsApp Auto-send",
    description: "Para o envio automático de mensagens WhatsApp",
    icon: MessageCircle,
    color: "green",
  },
  {
    key: "kill_trinks_sync",
    label: "Sync Trinks",
    description: "Pausa a sincronização com o Trinks",
    icon: RefreshCw,
    color: "blue",
  },
  {
    key: "kill_new_signups",
    label: "Novos Cadastros",
    description: "Bloqueia o onboarding de novas barbearias",
    icon: UserPlus,
    color: "yellow",
  },
  {
    key: "kill_image_pricing",
    label: "Precificação Auto",
    description: "Pausa o cron de atualização de preços de imagem (USD/BRL)",
    icon: TrendingUp,
    color: "zinc",
  },
];

const CRON_LABELS: Record<string, string> = {
  "daily":                  "Cron Diário",
  "hourly-sync":            "Sync Horário",
  "whatsapp-send":          "WhatsApp Send",
  "campaigns-publish":      "Publica Campanhas",
  "update-image-pricing":   "Precificação de Imagens",
};

function formatAgo(iso: string | null): string {
  if (!iso) return "Nunca executou";
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (days > 0)  return `há ${days}d`;
  if (hours > 0) return `há ${hours}h`;
  return `há ${mins}min`;
}

function formatDuration(ms: number | null): string {
  if (!ms) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function daysUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const days = Math.ceil(diff / (24 * 60 * 60 * 1000));
  if (days <= 0) return "expira hoje";
  if (days === 1) return "expira amanhã";
  return `expira em ${days}d`;
}

export function OverviewClient({ killSwitches: initial, cronRuns: initialCronRuns, queues, metrics, imagePricing }: Props) {
  const [kills,      setKills]      = useState<KillSwitches>(initial);
  const [loading,    setLoading]    = useState<Partial<Record<keyof KillSwitches, boolean>>>({});
  const [runningCron,setRunningCron]= useState<string | null>(null);
  const [localRuns,  setLocalRuns]  = useState<CronRun[]>(initialCronRuns);
  const [cronMsg,    setCronMsg]    = useState<Record<string, { ok: boolean; msg: string }>>({});

  async function runCron(cronName: string) {
    setRunningCron(cronName);
    setCronMsg((prev) => ({ ...prev, [cronName]: { ok: true, msg: "" } }));
    const now = new Date().toISOString();
    try {
      const res  = await fetch("/api/admin/run-cron", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ cronName }),
      });
      const data = await res.json();
      const ok   = res.ok && data.ok;
      const errMsg = !ok ? (data.data?.error ?? data.error ?? "Erro desconhecido") : null;

      // Update local cron run state so dot + time refresh immediately
      setLocalRuns((prev) => prev.map((r) =>
        r.name === cronName
          ? { ...r, status: ok ? "success" : "failed", ranAt: now, isLate: false, error: errMsg }
          : r,
      ));
      setCronMsg((prev) => ({
        ...prev,
        [cronName]: { ok, msg: ok ? "OK" : (errMsg ?? "Erro") },
      }));
    } catch (e) {
      setLocalRuns((prev) => prev.map((r) =>
        r.name === cronName ? { ...r, status: "failed", ranAt: now, isLate: false, error: String(e) } : r,
      ));
      setCronMsg((prev) => ({ ...prev, [cronName]: { ok: false, msg: String(e) } }));
    } finally {
      setRunningCron(null);
    }
  }

  async function toggleKill(key: keyof KillSwitches) {
    const newVal = !kills[key];
    setLoading((l) => ({ ...l, [key]: true }));
    try {
      await fetch("/api/admin/platform-config", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ key, value: String(newVal) }),
      });
      setKills((k) => ({ ...k, [key]: newVal }));
    } finally {
      setLoading((l) => ({ ...l, [key]: false }));
    }
  }

  const anyKillActive = Object.values(kills).some(Boolean);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">Overview</h1>
            <p className="text-sm text-zinc-400 mt-0.5">Saúde da plataforma e controles de emergência</p>
          </div>
          {anyKillActive && (
            <Badge className="border-red-500/40 bg-red-500/15 text-red-400 text-xs px-3 py-1">
              <AlertTriangle className="w-3 h-3 mr-1.5" />
              Kill switch ativo
            </Badge>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* ── Métricas rápidas ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Barbearias", value: metrics.totalShops, icon: Users,     color: "zinc"   },
            { label: "Em Trial",         value: metrics.trialing,   icon: Timer,     color: "blue"   },
            { label: "IA Hoje",          value: metrics.aiToday,    icon: Brain,     color: "purple" },
            { label: "IA Este Mês",      value: metrics.aiThisMonth, icon: BarChart3, color: "gold"  },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 text-${color}-400`} />
                <span className="text-xs text-zinc-400">{label}</span>
              </div>
              <p className="text-2xl font-bold text-white">{value}</p>
            </div>
          ))}
        </div>

        {/* ── Kill Switches ── */}
        <section>
          <h2 className="text-sm font-semibold text-zinc-300 mb-3 uppercase tracking-wider">
            Kill Switches
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {KILL_SWITCH_META.map(({ key, label, description, icon: Icon, color }) => {
              const active  = kills[key];
              const pending = loading[key];
              return (
                <div
                  key={key}
                  className={`bg-zinc-900 border rounded-lg p-4 flex items-start justify-between gap-4 transition-colors ${
                    active ? "border-red-500/40 bg-red-500/5" : "border-zinc-800"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 p-1.5 rounded-md ${active ? "bg-red-500/15" : `bg-${color}-500/10`}`}>
                      <Icon className={`w-4 h-4 ${active ? "text-red-400" : `text-${color}-400`}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{label}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">{description}</p>
                      {active && (
                        <Badge className="mt-1.5 border-red-500/40 bg-red-500/10 text-red-400 text-xs px-2 py-0.5">
                          ATIVO
                        </Badge>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleKill(key)}
                    disabled={pending}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50 ${
                      active ? "bg-red-500" : "bg-zinc-700"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        active ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Saúde dos Crons ── */}
        <section>
          <h2 className="text-sm font-semibold text-zinc-300 mb-3 uppercase tracking-wider">
            Saúde dos Crons
          </h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg divide-y divide-zinc-800">
            {localRuns.map((run) => {
              const ok      = run.status === "success";
              const failed  = run.status === "failed";
              const running = run.status === "running";
              const never   = !run.status;
              return (
                <div key={run.name} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      never   ? "bg-zinc-600" :
                      running ? "bg-blue-400 animate-pulse" :
                      failed  ? "bg-red-500" :
                      run.isLate ? "bg-yellow-500" :
                      "bg-green-500"
                    }`} />
                    <div>
                      <p className="text-sm text-white">{CRON_LABELS[run.name] ?? run.name}</p>
                      {run.error && !run.error.includes("active — skipped") && (
                        <p className="text-xs text-red-400 mt-0.5 truncate max-w-xs">{run.error}</p>
                      )}
                      {run.error?.includes("active — skipped") && (
                        <p className="text-xs text-yellow-400 mt-0.5">Pulado por kill switch</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    {cronMsg[run.name]?.msg && (
                      <span className={`text-xs ${cronMsg[run.name].ok ? "text-green-400" : "text-red-400"}`}>
                        {cronMsg[run.name].msg}
                      </span>
                    )}
                    {run.durationMs && (
                      <span className="text-xs text-zinc-500">{formatDuration(run.durationMs)}</span>
                    )}
                    <div className="text-xs">
                      {never ? (
                        <span className="text-zinc-500">Nunca executou</span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className={run.isLate ? "text-yellow-400" : "text-zinc-400"}>
                            {formatAgo(run.ranAt)}
                          </span>
                          {run.isLate && <AlertTriangle className="w-3 h-3 text-yellow-400" />}
                          {failed && <XCircle className="w-3 h-3 text-red-400" />}
                          {ok && !run.isLate && <CheckCircle className="w-3 h-3 text-green-500" />}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => runCron(run.name)}
                      disabled={runningCron === run.name}
                      title="Rodar manualmente"
                      className="flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors disabled:opacity-40"
                    >
                      {runningCron === run.name
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Play className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Filas & Erros ── */}
        <section>
          <h2 className="text-sm font-semibold text-zinc-300 mb-3 uppercase tracking-wider">
            Filas & Erros
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            {[
              {
                label: "WhatsApp Fila",
                value: queues.waQueued,
                icon:  MessageCircle,
                color: queues.waQueued > 0 ? "yellow" : "zinc",
              },
              {
                label: "WhatsApp Falhas (24h)",
                value: queues.waFailed,
                icon:  XCircle,
                color: queues.waFailed > 0 ? "red" : "zinc",
              },
              {
                label: "Campanhas Agendadas",
                value: queues.campaignsScheduled,
                icon:  Clock,
                color: "zinc",
              },
            ].map(({ label, value, icon: Icon, color }) => (
              <div
                key={label}
                className={`bg-zinc-900 border rounded-lg p-4 flex items-center justify-between ${
                  color === "red"    ? "border-red-500/30"    :
                  color === "yellow" ? "border-yellow-500/30" :
                  "border-zinc-800"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 text-${color}-400`} />
                  <span className="text-sm text-zinc-300">{label}</span>
                </div>
                <span className={`text-xl font-bold ${
                  color === "red"    ? "text-red-400"    :
                  color === "yellow" ? "text-yellow-400" :
                  "text-white"
                }`}>{value}</span>
              </div>
            ))}
          </div>

          {queues.syncFailures.length > 0 && (
            <div className="bg-zinc-900 border border-red-500/20 rounded-lg">
              <div className="px-4 py-3 border-b border-zinc-800">
                <p className="text-sm font-medium text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Sync failures nas últimas 24h ({queues.syncFailures.length})
                </p>
              </div>
              <div className="divide-y divide-zinc-800">
                {queues.syncFailures.map((s) => (
                  <div key={s.id} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-zinc-300">{s.barbershopName}</span>
                    <div className="flex items-center gap-3">
                      {s.errorsCount > 0 && (
                        <span className="text-xs text-red-400">{s.errorsCount} erros</span>
                      )}
                      <Badge className={`text-xs ${
                        s.status === "FAILED"
                          ? "border-red-500/30 bg-red-500/10 text-red-400"
                          : "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
                      }`}>
                        {s.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Alertas ── */}
        {(metrics.trialsExpiringSoon.length > 0 || metrics.nearLimit.length > 0) && (
          <section>
            <h2 className="text-sm font-semibold text-zinc-300 mb-3 uppercase tracking-wider">
              Alertas
            </h2>
            <div className="space-y-3">
              {metrics.trialsExpiringSoon.length > 0 && (
                <div className="bg-zinc-900 border border-yellow-500/20 rounded-lg">
                  <div className="px-4 py-3 border-b border-zinc-800">
                    <p className="text-sm font-medium text-yellow-400 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Trials expirando em ≤3 dias ({metrics.trialsExpiringSoon.length})
                    </p>
                  </div>
                  <div className="divide-y divide-zinc-800">
                    {metrics.trialsExpiringSoon.map((t) => (
                      <div key={t.barbershopId} className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-sm text-zinc-300">{t.barbershopName}</span>
                        <span className="text-xs text-yellow-400">{daysUntil(t.trialEndsAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {metrics.nearLimit.length > 0 && (
                <div className="bg-zinc-900 border border-orange-500/20 rounded-lg">
                  <div className="px-4 py-3 border-b border-zinc-800">
                    <p className="text-sm font-medium text-orange-400 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Perto do limite de IA ≥80% ({metrics.nearLimit.length})
                    </p>
                  </div>
                  <div className="divide-y divide-zinc-800">
                    {metrics.nearLimit.map((n) => (
                      <div key={n.barbershopId} className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-sm text-zinc-300">{n.barbershopName}</span>
                        <span className="text-xs text-orange-400">
                          {n.usageCount}/{n.limit} ({Math.round((n.usageCount / n.limit) * 100)}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

      {/* ── Precificação de Imagens ──────────────────────────── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Precificação de Imagens (gpt-image-1)</p>
            <p className="text-xs text-zinc-500 mt-0.5">Atualizado diariamente via cron · 35% de margem</p>
          </div>
          <button
            onClick={() => runCron("update-image-pricing")}
            disabled={runningCron === "update-image-pricing"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors disabled:opacity-50"
          >
            {runningCron === "update-image-pricing"
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <RefreshCw className="h-3.5 w-3.5" />}
            Atualizar agora
          </button>
        </div>

        {imagePricing.updatedAt ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border border-zinc-700 bg-zinc-800/60 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">USD/BRL</p>
              <p className="text-lg font-bold text-white mt-1">
                {imagePricing.usdBrl ? `R$${imagePricing.usdBrl.toFixed(2)}` : "—"}
              </p>
              <p className="text-[10px] text-zinc-600 mt-0.5">{imagePricing.rateSource ?? ""}</p>
            </div>
            <div className="rounded-lg border border-green-500/20 bg-zinc-800/60 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-green-400/70">Rascunho</p>
              <p className="text-lg font-bold text-green-400 mt-1">{imagePricing.credits?.low ?? "—"} créditos</p>
              <p className="text-[10px] text-zinc-500">≈ R${((imagePricing.credits?.low ?? 0) * 0.10).toFixed(2)}</p>
            </div>
            <div className="rounded-lg border border-amber-500/20 bg-zinc-800/60 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-amber-400/70">Padrão</p>
              <p className="text-lg font-bold text-amber-400 mt-1">{imagePricing.credits?.medium ?? "—"} créditos</p>
              <p className="text-[10px] text-zinc-500">≈ R${((imagePricing.credits?.medium ?? 0) * 0.10).toFixed(2)}</p>
            </div>
            <div className="rounded-lg border border-red-500/20 bg-zinc-800/60 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-red-400/70">Alta qualidade</p>
              <p className="text-lg font-bold text-red-400 mt-1">{imagePricing.credits?.high ?? "—"} créditos</p>
              <p className="text-[10px] text-zinc-500">≈ R${((imagePricing.credits?.high ?? 0) * 0.10).toFixed(2)}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">Cron ainda não executou. Clique em &ldquo;Atualizar agora&rdquo; para calcular.</p>
        )}

        {imagePricing.updatedAt && (
          <p className="text-[10px] text-zinc-600">
            Última atualização: {new Date(imagePricing.updatedAt).toLocaleString("pt-BR")}
          </p>
        )}
      </div>

      </div>
    </div>
  );
}
