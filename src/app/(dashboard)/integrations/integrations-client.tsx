"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/utils";
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, Plug, Clock, Settings } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface IntegrationInfo {
  status:     string;
  lastSyncAt: string | null;
  errorMsg:   string | null;
  configured: boolean;
}
interface SyncRunInfo {
  id:                  string;
  status:              string;
  triggeredBy:         string | null;
  customersUpserted:   number;
  servicesUpserted:    number;
  appointmentsUpserted:number;
  errorsCount:         number;
  durationMs:          number | null;
  startedAt:           string;
}

const RUN_STATUS_VARIANT = { RUNNING: "warning", SUCCESS: "success", PARTIAL: "warning", FAILED: "destructive" } as const;
const RUN_STATUS_LABEL   = { RUNNING: "Rodando", SUCCESS: "Sucesso", PARTIAL: "Parcial", FAILED: "Falhou" };

export function IntegrationsClient({ integration, syncRuns }: {
  integration: IntegrationInfo | null;
  syncRuns:    SyncRunInfo[];
}) {
  const [syncing,    setSyncing]    = useState(false);
  const [runs,       setRuns]       = useState(syncRuns);
  const [showForm,   setShowForm]   = useState(!integration?.configured);
  const [apiKey,     setApiKey]     = useState("");
  const [estabId,    setEstabId]    = useState("");
  const [saving,     setSaving]     = useState(false);
  const [formError,  setFormError]  = useState("");
  const [estabs,     setEstabs]     = useState<{ id: string; nome: string }[]>([]);
  const [loadingEstab, setLoadingEstab] = useState(false);

  async function handleSave() {
    setFormError("");
    setSaving(true);
    try {
      const res = await fetch("/api/trinks/configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, estabelecimentoId: estabId }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error ?? "Erro ao salvar"); return; }
      toast({ title: "Trinks configurada!", description: "Credenciais salvas e validadas." });
      window.location.reload();
    } catch {
      setFormError("Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function handleFetchEstabs() {
    setFormError("");
    setLoadingEstab(true);
    try {
      const res = await fetch("/api/trinks/estabelecimentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao buscar estabelecimentos");
      setEstabs((data.items ?? []).map((e: any) => ({ id: String(e.id), nome: e.nome })));
    } catch (e) {
      setFormError(String(e));
    } finally {
      setLoadingEstab(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/trinks/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      toast({
        title: "Sync concluído",
        description: `${data.customersUpserted} clientes, ${data.servicesUpserted} serviços, ${data.appointmentsUpserted} agendamentos.`,
      });
      // Refresh page to show new run
      window.location.reload();
    } catch (e) {
      toast({ title: "Erro no sync", description: String(e), variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  }

  const statusColor = {
    ACTIVE:       "text-green-400",
    ERROR:        "text-red-400",
    PAUSED:       "text-yellow-400",
    UNCONFIGURED: "text-muted-foreground",
  };

  return (
    <div className="p-6 space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold-500/10 border border-gold-500/20">
                <Plug className="h-5 w-5 text-gold-400" />
              </div>
              <div>
                <CardTitle className="text-base">Trinks</CardTitle>
                <p className="text-xs text-muted-foreground">Plataforma operacional principal</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={integration?.status === "ACTIVE" ? "success" : "warning"}>
                {integration?.status ?? "UNCONFIGURED"}
              </Badge>
              <Button onClick={handleSync} disabled={syncing || !integration?.configured} size="sm">
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Sincronizando..." : "Sync Manual"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Último sync</p>
              <p className="text-foreground">
                {integration?.lastSyncAt ? relativeTime(integration.lastSyncAt) : "Nunca"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Configurada</p>
              <p className={integration?.configured ? "text-green-400" : "text-yellow-400"}>
                {integration?.configured ? "Sim" : "Não – configure via variáveis de ambiente"}
              </p>
            </div>
          </div>
          {integration?.errorMsg && (
            <div className="mt-4 rounded-md border border-red-500/20 bg-red-500/8 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{integration.errorMsg}</p>
            </div>
          )}

          {/* Config form */}
          {showForm ? (
            <div className="mt-4 space-y-3 rounded-lg border border-border bg-surface-800/50 p-4">
              <p className="text-xs font-semibold text-foreground">Configurar credenciais da Trinks</p>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">API Key</label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Cole sua API Key da Trinks aqui"
                  className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted-foreground">ID do Estabelecimento</label>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-[11px]"
                    onClick={handleFetchEstabs}
                    disabled={!apiKey || loadingEstab}
                    title="Buscar lista com a API Key"
                  >
                    {loadingEstab ? <RefreshCw className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  </Button>
                </div>
                {estabs.length > 0 ? (
                  <select
                    value={estabId}
                    onChange={(e) => setEstabId(e.target.value)}
                    className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Selecione</option>
                    {estabs.map((e) => (
                      <option key={e.id} value={e.id}>{e.nome} (ID {e.id})</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={estabId}
                    onChange={(e) => setEstabId(e.target.value)}
                    placeholder="Ex: 123456"
                    className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                )}
              </div>
              {formError && (
                <p className="text-xs text-red-400 rounded border border-red-500/20 bg-red-500/8 px-3 py-2">{formError}</p>
              )}
              <div className="flex gap-2">
                <Button size="sm" className="text-xs" onClick={handleSave} disabled={saving || !apiKey || !estabId}>
                  {saving ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Salvar e validar"}
                </Button>
                {integration?.configured && (
                  <Button size="sm" variant="ghost" className="text-xs" onClick={() => setShowForm(false)}>
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 flex justify-end">
              <Button size="sm" variant="ghost" className="text-xs gap-1" onClick={() => setShowForm(true)}>
                <Settings className="h-3.5 w-3.5" /> Reconfigurar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync History */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-gold-400" />
          Histórico de sincronizações
        </h2>

        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum sync realizado ainda</p>
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-800/50">
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Data</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Clientes</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Serviços</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Agendamentos</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Erros</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Duração</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Origem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {runs.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-800/30">
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{relativeTime(r.startedAt)}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={RUN_STATUS_VARIANT[r.status as keyof typeof RUN_STATUS_VARIANT] as never} className="text-[10px]">
                        {RUN_STATUS_LABEL[r.status as keyof typeof RUN_STATUS_LABEL] ?? r.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs tabular-nums">{r.customersUpserted}</td>
                    <td className="px-4 py-2.5 text-xs tabular-nums">{r.servicesUpserted}</td>
                    <td className="px-4 py-2.5 text-xs tabular-nums">{r.appointmentsUpserted}</td>
                    <td className="px-4 py-2.5 text-xs">
                      {r.errorsCount > 0 ? (
                        <span className="text-red-400">{r.errorsCount}</span>
                      ) : <span className="text-green-400">0</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {r.durationMs ? `${(r.durationMs / 1000).toFixed(1)}s` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.triggeredBy ?? "auto"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
