"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/utils";
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, Plug, Clock } from "lucide-react";
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
  const [syncing, setSyncing] = useState(false);
  const [runs, setRuns]       = useState(syncRuns);

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

          <div className="mt-4 rounded-md bg-surface-800 p-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Nota:</strong> A Trinks é a fonte operacional principal.
              Os dados de agenda, clientes e serviços são importados dela e usados para gerar inteligência neste painel.
              As credenciais de API são configuradas no banco de dados via painel de administração.
            </p>
          </div>
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
