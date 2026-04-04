"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/utils";
import { RefreshCw, CheckCircle2, AlertTriangle, Plug, Clock, Settings, ChevronDown, Copy, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface IntegrationInfo {
  status:     string;
  lastSyncAt: string | null;
  errorMsg:   string | null;
  configured: boolean;
  instagramPageAccessToken?: string | null;
  instagramBusinessId?: string | null;
  instagramUsername?: string | null;
  whatsappConfigured?: boolean;
  whatsappVerifyToken?: string | null;
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
  errorDetails?:       string | null;
}

const RUN_STATUS_VARIANT = { RUNNING: "warning", SUCCESS: "success", PARTIAL: "warning", FAILED: "destructive" } as const;
const RUN_STATUS_LABEL   = { RUNNING: "Rodando", SUCCESS: "Sucesso", PARTIAL: "Parcial", FAILED: "Falhou" };

export function IntegrationsClient({ integration, syncRuns, barbershopId }: {
  integration:  IntegrationInfo | null;
  syncRuns:     SyncRunInfo[];
  barbershopId: string;
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
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [igToken,       setIgToken]       = useState("");
  const [igBizId,       setIgBizId]       = useState("");
  const [igPageId,      setIgPageId]      = useState("");
  const [igSelectedName, setIgSelectedName] = useState("");
  const [savingIg,      setSavingIg]      = useState(false);
  const [editingIg,     setEditingIg]     = useState(!integration?.instagramBusinessId);
  const [displayBizId,  setDisplayBizId]  = useState(integration?.instagramBusinessId ?? "");
  const [displayUsername, setDisplayUsername] = useState(integration?.instagramUsername ?? "");
  const [discovering, setDiscovering] = useState(false);
  const [igAccounts,  setIgAccounts]  = useState<{ pageId: string; pageName: string; instagramId: string; instagramName: string; pageToken: string }[]>([]);

  // WhatsApp
  const [waConfigured,   setWaConfigured]   = useState(integration?.whatsappConfigured ?? false);
  const [waEditing,      setWaEditing]       = useState(!integration?.whatsappConfigured);
  const [waToken,        setWaToken]         = useState("");
  const [waPhoneId,      setWaPhoneId]       = useState("");
  const [waSaving,       setWaSaving]        = useState(false);
  const [waWebhookUrl,   setWaWebhookUrl]    = useState("");
  const [waVerifyToken,  setWaVerifyToken]   = useState(integration?.whatsappVerifyToken ?? "");
  const [waCopied,       setWaCopied]        = useState<"url" | "token" | null>(null);
  const [waLoadingSetup, setWaLoadingSetup]  = useState(false);

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

  async function handleDiscoverInstagram() {
    setDiscovering(true);
    setIgAccounts([]);
    try {
      const res = await fetch("/api/integrations/instagram/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: igToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao buscar contas");
      setIgAccounts(data.accounts ?? []);
      if (data.accounts?.length === 1) {
        setIgBizId(data.accounts[0].instagramId);
        setIgPageId(data.accounts[0].pageId);
      }
      toast({ title: `${data.accounts.length} conta(s) encontrada(s)`, description: "Selecione a conta para publicar." });
    } catch (e) {
      toast({ title: "Erro ao buscar contas", description: String(e), variant: "destructive" });
    } finally {
      setDiscovering(false);
    }
  }

  async function handleSaveInstagram() {
    setSavingIg(true);
    try {
      const res = await fetch("/api/integrations/instagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: igToken, businessId: igBizId, pageId: igPageId, username: igSelectedName || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar Instagram");
      toast({ title: "Instagram conectado", description: "Dados salvos com sucesso." });
      setDisplayBizId(igBizId);
      setDisplayUsername(igSelectedName);
      setEditingIg(false);
    } catch (e) {
      toast({ title: "Erro ao salvar Instagram", description: String(e), variant: "destructive" });
    } finally {
      setSavingIg(false);
    }
  }

  async function handleLoadWaSetup() {
    setWaLoadingSetup(true);
    try {
      const res = await fetch("/api/whatsapp/setup");
      const data = await res.json();
      if (res.ok) {
        setWaWebhookUrl(data.webhookUrl ?? "");
        setWaVerifyToken(data.verifyToken ?? "");
      }
    } finally {
      setWaLoadingSetup(false);
    }
  }

  async function handleSaveWhatsApp() {
    setWaSaving(true);
    try {
      const res = await fetch("/api/whatsapp/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: waToken, phoneNumberId: waPhoneId }),
      });
      if (!res.ok) throw new Error("Erro ao salvar");
      toast({ title: "WhatsApp configurado!", description: "Credenciais salvas com sucesso." });
      setWaConfigured(true);
      setWaEditing(false);
    } catch (e) {
      toast({ title: "Erro ao salvar WhatsApp", description: String(e), variant: "destructive" });
    } finally {
      setWaSaving(false);
    }
  }

  function handleCopy(value: string, type: "url" | "token") {
    navigator.clipboard.writeText(value);
    setWaCopied(type);
    setTimeout(() => setWaCopied(null), 2000);
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold-500/10 border border-gold-500/20">
                <Plug className="h-5 w-5 text-gold-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">Trinks</CardTitle>
                  <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">Opcional</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Sistema de agendamentos online — sincroniza clientes, serviços e agenda ao vivo</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={integration?.status === "ACTIVE" ? "success" : "outline"} className={integration?.status === "ACTIVE" ? "" : "text-muted-foreground"}>
                {integration?.status === "ACTIVE" ? "Ativo" : "Não conectado"}
              </Badge>
              <Button onClick={handleSync} disabled={syncing || !integration?.configured} size="sm">
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Sincronizando..." : "Sync"}
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
              <p className={integration?.configured ? "text-green-400" : "text-muted-foreground"}>
                {integration?.configured ? "Sim" : "Não conectado"}
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
              <div>
                <p className="text-xs font-semibold text-foreground">Conectar ao Trinks</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  O Trinks é um sistema de agendamentos online usado por barbearias. Ao conectar, seus clientes, serviços e agenda do dia aparecem automaticamente aqui. Se você não usa o Trinks, pode ignorar esta seção.
                </p>
              </div>
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

      {/* Instagram Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                <Plug className="h-5 w-5 text-indigo-300" />
              </div>
              <div>
                <CardTitle className="text-base">Instagram</CardTitle>
                <p className="text-xs text-muted-foreground">Necessário para publicar campanhas</p>
              </div>
            </div>
            <Badge variant="outline" className="text-xs">Canal de campanhas</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {editingIg ? (
            <>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Page Access Token</label>
                <div className="flex gap-2">
                  <input
                    value={igToken}
                    onChange={(e) => { setIgToken(e.target.value); setIgAccounts([]); }}
                    placeholder="EAAG..."
                    className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground"
                  />
                  <Button size="sm" variant="outline" onClick={handleDiscoverInstagram} disabled={!igToken || discovering} className="text-xs shrink-0">
                    {discovering ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Buscar contas"}
                  </Button>
                </div>
              </div>
              {igAccounts.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Conta do Instagram</label>
                  <div className="space-y-1">
                    {igAccounts.map((acc) => (
                      <button
                        key={acc.instagramId}
                        type="button"
                        onClick={() => { setIgBizId(acc.instagramId); setIgPageId(acc.pageId); setIgSelectedName(acc.instagramName); }}
                        className={`w-full text-left rounded-md border px-3 py-2 text-xs transition-colors ${igBizId === acc.instagramId ? "border-gold-500/60 bg-gold-500/10 text-foreground" : "border-border bg-surface-800 text-muted-foreground hover:text-foreground"}`}
                      >
                        <span className="font-medium">@{acc.instagramName}</span>
                        <span className="ml-2 text-[11px] opacity-60">via {acc.pageName} · ID: {acc.instagramId}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {igAccounts.length === 0 && igBizId && (
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Instagram Business ID</label>
                    <input
                      value={igBizId}
                      onChange={(e) => setIgBizId(e.target.value)}
                      placeholder="ex: 1784..."
                      className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Page ID (opcional)</label>
                    <input
                      value={igPageId}
                      onChange={(e) => setIgPageId(e.target.value)}
                      placeholder="ID da página do Facebook"
                      className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                {displayBizId && (
                  <Button size="sm" variant="ghost" className="text-xs" onClick={() => setEditingIg(false)}>
                    Cancelar
                  </Button>
                )}
                <Button size="sm" onClick={handleSaveInstagram} disabled={savingIg || !igToken || !igBizId} className="text-xs ml-auto">
                  {savingIg ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Salvar Instagram"}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">Cole o token e clique em &quot;Buscar contas&quot; para detectar automaticamente o Instagram Business ID.</p>
            </>
          ) : (
            <div className="rounded-md border border-green-500/30 bg-green-500/8 px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                <div className="text-xs space-y-0.5">
                  <p className="font-semibold text-green-400">Conectado</p>
                  {displayUsername ? (
                    <p className="text-foreground font-medium">
                      <a
                        href={`https://instagram.com/${displayUsername}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-400 hover:text-indigo-300 hover:underline transition-colors"
                      >
                        @{displayUsername}
                      </a>
                    </p>
                  ) : null}
                  <p className="text-muted-foreground">
                    Business ID: <span className="font-mono text-foreground/70">{displayBizId}</span>
                  </p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="text-xs shrink-0 gap-1" onClick={() => setEditingIg(true)}>
                <Settings className="h-3.5 w-3.5" /> Editar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* WhatsApp Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 border border-green-500/20">
                <Plug className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <CardTitle className="text-base">WhatsApp Business</CardTitle>
                <p className="text-xs text-muted-foreground">Envio de mensagens automáticas para clientes</p>
              </div>
            </div>
            <Badge variant={waConfigured ? "success" : "outline"} className="text-xs">
              {waConfigured ? "Conectado" : "Não configurado"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {waEditing ? (
            <>
              {/* Webhook info */}
              <div className="rounded-md border border-border bg-surface-800/50 p-3 space-y-2">
                <p className="text-xs font-semibold text-foreground">1. Configure o webhook no painel Meta</p>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">URL do Webhook</label>
                  <div className="flex gap-2 items-center">
                    {waWebhookUrl ? (
                      <>
                        <code className="flex-1 rounded-md border border-border bg-surface-800 px-3 py-2 text-xs text-foreground font-mono truncate">
                          {waWebhookUrl}
                        </code>
                        <Button size="icon-sm" variant="ghost" onClick={() => handleCopy(waWebhookUrl, "url")}>
                          {waCopied === "url" ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="outline" className="text-xs" onClick={handleLoadWaSetup} disabled={waLoadingSetup}>
                        {waLoadingSetup ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : null}
                        Gerar URL do Webhook
                      </Button>
                    )}
                  </div>
                </div>
                {waVerifyToken && (
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Verify Token</label>
                    <div className="flex gap-2 items-center">
                      <code className="flex-1 rounded-md border border-border bg-surface-800 px-3 py-2 text-xs text-foreground font-mono truncate">
                        {waVerifyToken}
                      </code>
                      <Button size="icon-sm" variant="ghost" onClick={() => handleCopy(waVerifyToken, "token")}>
                        {waCopied === "token" ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Credentials */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground">2. Cole suas credenciais da Meta</p>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Access Token (permanente)</label>
                  <input
                    value={waToken}
                    onChange={(e) => setWaToken(e.target.value)}
                    placeholder="EAAGm..."
                    className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Phone Number ID</label>
                  <input
                    value={waPhoneId}
                    onChange={(e) => setWaPhoneId(e.target.value)}
                    placeholder="ex: 123456789012345"
                    className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button size="sm" className="text-xs" onClick={handleSaveWhatsApp} disabled={waSaving || !waToken || !waPhoneId}>
                  {waSaving ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : null}
                  Salvar
                </Button>
                {waConfigured && (
                  <Button size="sm" variant="ghost" className="text-xs" onClick={() => setWaEditing(false)}>
                    Cancelar
                  </Button>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-md border border-green-500/30 bg-green-500/8 px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                <p className="text-xs font-semibold text-green-400">Credenciais configuradas</p>
              </div>
              <Button size="sm" variant="outline" className="text-xs shrink-0 gap-1" onClick={() => { setWaEditing(true); handleLoadWaSetup(); }}>
                <Settings className="h-3.5 w-3.5" /> Editar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync History */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Clock className="h-4 w-4 text-gold-400" />
          Histórico de sincronizações
        </h2>

        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum sync realizado ainda</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="rounded-lg border border-border bg-card overflow-hidden hidden md:block">
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
                    <tr
                      key={r.id}
                      className="hover:bg-surface-800/30 cursor-pointer"
                      onClick={() => setExpandedRun(expandedRun === r.id ? null : r.id)}
                    >
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
                      <td className="px-4 py-2.5 text-xs text-muted-foreground flex items-center gap-1">
                        {r.triggeredBy ?? "auto"}
                        <ChevronDown className={`h-3 w-3 transition-transform ${expandedRun === r.id ? "rotate-180" : ""}`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-2 md:hidden">
              {runs.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setExpandedRun(expandedRun === r.id ? null : r.id)}
                  className="w-full text-left rounded-lg border border-border bg-surface-900 p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{relativeTime(r.startedAt)}</span>
                    <Badge variant={RUN_STATUS_VARIANT[r.status as keyof typeof RUN_STATUS_VARIANT] as never} className="text-[10px]">
                      {RUN_STATUS_LABEL[r.status as keyof typeof RUN_STATUS_LABEL] ?? r.status}
                    </Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-foreground/90">
                    <span>Clientes: {r.customersUpserted}</span>
                    <span>Serviços: {r.servicesUpserted}</span>
                    <span>Agends: {r.appointmentsUpserted}</span>
                    <span className={r.errorsCount > 0 ? "text-red-400" : "text-green-400"}>Erros: {r.errorsCount}</span>
                    <span>Duração: {r.durationMs ? `${(r.durationMs / 1000).toFixed(1)}s` : "—"}</span>
                    <span>Origem: {r.triggeredBy ?? "auto"}</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {expandedRun && (() => {
        const run = runs.find((r) => r.id === expandedRun);
        if (!run) return null;
        const details = run.errorsCount > 0 && run.errorDetails ? (() => {
          try { return JSON.parse(run.errorDetails); } catch { return run.errorDetails; }
        })() : null;
        return (
          <div className="rounded-lg border border-border bg-surface-900 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Detalhes do sync</p>
              <Badge variant={RUN_STATUS_VARIANT[run.status as keyof typeof RUN_STATUS_VARIANT] as never}>{RUN_STATUS_LABEL[run.status as keyof typeof RUN_STATUS_LABEL]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">ID: {run.id}</p>
            <p className="text-xs text-muted-foreground">Erros: {run.errorsCount}</p>
            {details && Array.isArray(details) ? (
              <div className="bg-surface-800 rounded-md border border-border p-3 space-y-1">
                {details.map((d: any, idx: number) => (
                  <p key={idx} className="text-xs text-red-300">• {d.entity ?? "?"}: {d.message ?? JSON.stringify(d)}</p>
                ))}
              </div>
            ) : details ? (
              <p className="text-xs text-red-300">{String(details)}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Sem detalhes adicionais.</p>
            )}
          </div>
        );
      })()}
    </div>
  );
}
