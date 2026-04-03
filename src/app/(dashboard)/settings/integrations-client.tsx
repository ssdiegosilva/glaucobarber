"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/utils";
import {
  RefreshCw, CheckCircle2, AlertTriangle, Plug, Clock,
  Settings, ChevronDown, Copy, Check, Unplug, LogIn, Link2,
} from "lucide-react";
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
  whatsappWabaId?: string | null;
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

const HAS_OAUTH = !!process.env.NEXT_PUBLIC_INSTAGRAM_OAUTH_ENABLED;

export function IntegrationsClient({ integration, syncRuns, barbershopId }: {
  integration:  IntegrationInfo | null;
  syncRuns:     SyncRunInfo[];
  barbershopId: string;
}) {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const [syncing,      setSyncing]      = useState(false);
  const [runs,         setRuns]         = useState(syncRuns.slice(0, 5));
  const [showForm,     setShowForm]     = useState(!integration?.configured);
  const [apiKey,       setApiKey]       = useState("");
  const [estabId,      setEstabId]      = useState("");
  const [saving,       setSaving]       = useState(false);
  const [formError,    setFormError]    = useState("");
  const [estabs,       setEstabs]       = useState<{ id: string; nome: string }[]>([]);
  const [loadingEstab, setLoadingEstab] = useState(false);
  const [expandedRun,  setExpandedRun]  = useState<string | null>(null);
  const [showHistory,  setShowHistory]  = useState(false);

  // Instagram
  const [igToken,           setIgToken]           = useState("");
  const [igBizId,           setIgBizId]           = useState("");
  const [igPageId,          setIgPageId]          = useState("");
  const [igSelectedName,    setIgSelectedName]    = useState("");
  const [savingIg,          setSavingIg]          = useState(false);
  const [editingIg,         setEditingIg]         = useState(!integration?.instagramBusinessId);
  const [displayBizId,      setDisplayBizId]      = useState(integration?.instagramBusinessId ?? "");
  const [displayUsername,   setDisplayUsername]   = useState(integration?.instagramUsername ?? "");
  const [discovering,       setDiscovering]       = useState(false);
  const [igAccounts,        setIgAccounts]        = useState<{ pageId: string; pageName: string; instagramId: string; instagramName: string; pageToken: string }[]>([]);
  const [disconnectingIg,   setDisconnectingIg]   = useState(false);
  const [showManualFallback, setShowManualFallback] = useState(false);
  const [igPendingLoading,  setIgPendingLoading]  = useState(false);

  // Handle OAuth callback query params
  useEffect(() => {
    const ig  = searchParams.get("ig");
    const msg = searchParams.get("msg");
    if (!ig) return;

    if (ig === "connected") {
      toast({ title: "Instagram conectado com sucesso!" });
      window.location.replace("/settings");
    } else if (ig === "pending") {
      setIgPendingLoading(true);
      fetch("/api/integrations/instagram/pending")
        .then((r) => r.json())
        .then((data) => {
          if (data.accounts?.length > 0) {
            setIgAccounts(data.accounts);
            setEditingIg(true);
            setShowManualFallback(false);
          }
        })
        .finally(() => setIgPendingLoading(false));
      router.replace("/settings");
    } else if (ig === "error") {
      toast({ title: "Erro ao conectar Instagram", description: msg ?? "Tente novamente.", variant: "destructive" });
      router.replace("/settings");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // WhatsApp
  const [waConfigured,   setWaConfigured]   = useState(integration?.whatsappConfigured ?? false);
  const [waEditing,      setWaEditing]      = useState(!integration?.whatsappConfigured);
  const [waToken,        setWaToken]        = useState("");
  const [waPhoneId,      setWaPhoneId]      = useState("");
  const [waSaving,       setWaSaving]       = useState(false);
  const [waWebhookUrl,   setWaWebhookUrl]   = useState("");
  const [waVerifyToken,  setWaVerifyToken]  = useState(integration?.whatsappVerifyToken ?? "");
  const [waCopied,       setWaCopied]       = useState<"url" | "token" | null>(null);
  const [waLoadingSetup, setWaLoadingSetup] = useState(false);
  const [disconnectingWa, setDisconnectingWa] = useState(false);

  // WABA / Templates (seção separada)
  const [wabaId,       setWabaId]       = useState(integration?.whatsappWabaId ?? "");
  const [wabaEditing,  setWabaEditing]  = useState(false);
  const [wabaSaving,   setWabaSaving]   = useState(false);
  const [wabaSyncing,  setWabaSyncing]  = useState(false);
  const [wabaSyncMsg,  setWabaSyncMsg]  = useState<string | null>(null);

  // ── Trinks ────────────────────────────────────────────────────

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
      window.location.reload();
    } catch (e) {
      toast({ title: "Erro no sync", description: String(e), variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  }

  // ── Instagram ─────────────────────────────────────────────────

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
      toast({ title: `${data.accounts.length} conta(s) encontrada(s)` });
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
      toast({ title: "Instagram conectado" });
      setDisplayBizId(igBizId);
      setDisplayUsername(igSelectedName);
      setEditingIg(false);
    } catch (e) {
      toast({ title: "Erro ao salvar Instagram", description: String(e), variant: "destructive" });
    } finally {
      setSavingIg(false);
    }
  }

  async function handleDisconnectInstagram() {
    if (!confirm("Desconectar Instagram? Campanhas via Instagram vão parar de funcionar.")) return;
    setDisconnectingIg(true);
    try {
      const res = await fetch("/api/integrations/instagram", {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Erro ao desconectar");
      toast({ title: "Instagram desconectado" });
      setDisplayBizId("");
      setDisplayUsername("");
      setEditingIg(true);
    } catch (e) {
      toast({ title: "Erro", description: String(e), variant: "destructive" });
    } finally {
      setDisconnectingIg(false);
    }
  }

  // ── WhatsApp ──────────────────────────────────────────────────

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
      toast({ title: "WhatsApp configurado!" });
      setWaConfigured(true);
      setWaEditing(false);
    } catch (e) {
      toast({ title: "Erro ao salvar WhatsApp", description: String(e), variant: "destructive" });
    } finally {
      setWaSaving(false);
    }
  }

  async function handleSaveWaba() {
    setWabaSaving(true);
    try {
      const res = await fetch("/api/whatsapp/setup", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wabaId }),
      });
      if (!res.ok) throw new Error("Erro ao salvar WABA ID");
      toast({ title: "WABA ID salvo!" });
      setWabaEditing(false);
    } catch (e) {
      toast({ title: "Erro", description: String(e), variant: "destructive" });
    } finally {
      setWabaSaving(false);
    }
  }

  async function handleSyncTemplates() {
    setWabaSyncing(true);
    setWabaSyncMsg(null);
    try {
      const res  = await fetch("/api/whatsapp/templates/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao sincronizar");
      setWabaSyncMsg(`${data.synced} template${data.synced !== 1 ? "s" : ""} sincronizado${data.synced !== 1 ? "s" : ""}`);
    } catch (e) {
      toast({ title: "Erro ao sincronizar templates", description: String(e), variant: "destructive" });
    } finally {
      setWabaSyncing(false);
    }
  }

  async function handleDisconnectWhatsApp() {
    if (!confirm("Desconectar WhatsApp? O envio automático de mensagens vai parar.")) return;
    setDisconnectingWa(true);
    try {
      const res = await fetch("/api/whatsapp/setup", { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao desconectar");
      toast({ title: "WhatsApp desconectado" });
      setWaConfigured(false);
      setWaEditing(true);
      setWaToken("");
      setWaPhoneId("");
    } catch (e) {
      toast({ title: "Erro", description: String(e), variant: "destructive" });
    } finally {
      setDisconnectingWa(false);
    }
  }

  function handleCopy(value: string, type: "url" | "token") {
    navigator.clipboard.writeText(value);
    setWaCopied(type);
    setTimeout(() => setWaCopied(null), 2000);
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* ── Section header ────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Integrações</h2>
        <div className="flex-1 border-t border-border/40" />
      </div>

      {/* ── Trinks ────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold-500/10 border border-gold-500/20">
                <Plug className="h-5 w-5 text-gold-400" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base">Trinks</CardTitle>
                <p className="text-xs text-muted-foreground">Plataforma operacional principal</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={integration?.status === "ACTIVE" ? "success" : "warning"}>
                {integration?.status ?? "UNCONFIGURED"}
              </Badge>
              <Button onClick={handleSync} disabled={syncing || !integration?.configured} size="sm">
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">{syncing ? "Sincronizando..." : "Sync Manual"}</span>
                <span className="sm:hidden">{syncing ? "..." : "Sync"}</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Último sync</p>
              <p className="text-foreground text-sm">
                {integration?.lastSyncAt ? relativeTime(integration.lastSyncAt) : "Nunca"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Configurada</p>
              <p className={`text-sm ${integration?.configured ? "text-green-400" : "text-yellow-400"}`}>
                {integration?.configured ? "Sim" : "Não"}
              </p>
            </div>
          </div>

          {integration?.errorMsg && (
            <div className="rounded-md border border-red-500/20 bg-red-500/8 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{integration.errorMsg}</p>
            </div>
          )}

          {/* Config form */}
          {showForm ? (
            <div className="space-y-3 rounded-lg border border-border bg-surface-800/50 p-4">
              <p className="text-xs font-semibold text-foreground">Configurar credenciais da Trinks</p>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">API Key</label>
                <input
                  type="text" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Cole sua API Key da Trinks aqui"
                  className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted-foreground">ID do Estabelecimento</label>
                  <Button size="icon-sm" variant="ghost" onClick={handleFetchEstabs} disabled={!apiKey || loadingEstab}>
                    <RefreshCw className={`h-3 w-3 ${loadingEstab ? "animate-spin" : ""}`} />
                  </Button>
                </div>
                {estabs.length > 0 ? (
                  <select value={estabId} onChange={(e) => setEstabId(e.target.value)}
                    className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="">Selecione</option>
                    {estabs.map((e) => <option key={e.id} value={e.id}>{e.nome} (ID {e.id})</option>)}
                  </select>
                ) : (
                  <input type="text" value={estabId} onChange={(e) => setEstabId(e.target.value)}
                    placeholder="Ex: 123456"
                    className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                )}
              </div>
              {formError && <p className="text-xs text-red-400 rounded border border-red-500/20 bg-red-500/8 px-3 py-2">{formError}</p>}
              <div className="flex gap-2">
                <Button size="sm" className="text-xs" onClick={handleSave} disabled={saving || !apiKey || !estabId}>
                  {saving ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Salvar e validar"}
                </Button>
                {integration?.configured && (
                  <Button size="sm" variant="ghost" className="text-xs" onClick={() => setShowForm(false)}>Cancelar</Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex justify-end">
              <Button size="sm" variant="ghost" className="text-xs gap-1" onClick={() => setShowForm(true)}>
                <Settings className="h-3.5 w-3.5" /> Reconfigurar
              </Button>
            </div>
          )}

          {/* Sync history (collapsible, last 5) */}
          {runs.length > 0 && (
            <div className="border-t border-border pt-3">
              <button
                onClick={() => setShowHistory((v) => !v)}
                className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Histórico de sincronizações ({runs.length})
                </span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showHistory ? "rotate-180" : ""}`} />
              </button>

              {showHistory && (
                <div className="mt-3 space-y-2">
                  {runs.map((r) => (
                    <div key={r.id}>
                      <button
                        onClick={() => setExpandedRun(expandedRun === r.id ? null : r.id)}
                        className="w-full text-left rounded-lg border border-border bg-surface-900 px-3 py-2.5 hover:bg-surface-800/50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground">{relativeTime(r.startedAt)}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant={RUN_STATUS_VARIANT[r.status as keyof typeof RUN_STATUS_VARIANT] as never} className="text-[10px]">
                              {RUN_STATUS_LABEL[r.status as keyof typeof RUN_STATUS_LABEL] ?? r.status}
                            </Badge>
                            <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${expandedRun === r.id ? "rotate-180" : ""}`} />
                          </div>
                        </div>
                        <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-foreground/70">
                          <span>Clientes: {r.customersUpserted}</span>
                          <span>Serviços: {r.servicesUpserted}</span>
                          <span>Agendamentos: {r.appointmentsUpserted}</span>
                          <span className={r.errorsCount > 0 ? "text-red-400" : "text-green-400"}>
                            Erros: {r.errorsCount}
                          </span>
                          {r.durationMs && <span>Duração: {(r.durationMs / 1000).toFixed(1)}s</span>}
                        </div>
                      </button>

                      {expandedRun === r.id && r.errorDetails && (() => {
                        const details = (() => { try { return JSON.parse(r.errorDetails!); } catch { return r.errorDetails; } })();
                        return (
                          <div className="rounded-b-lg border border-t-0 border-border bg-surface-900 px-3 py-2 space-y-1">
                            {Array.isArray(details)
                              ? details.map((d: any, i: number) => (
                                  <p key={i} className="text-xs text-red-300">• {d.entity ?? "?"}: {d.message ?? JSON.stringify(d)}</p>
                                ))
                              : <p className="text-xs text-red-300">{String(details)}</p>
                            }
                          </div>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Instagram ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                <Plug className="h-5 w-5 text-indigo-300" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base">Instagram</CardTitle>
                <p className="text-xs text-muted-foreground">Necessário para publicar campanhas</p>
              </div>
            </div>
            <Badge variant="outline" className="text-xs self-start sm:self-auto">Canal de campanhas</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Requirements notice — always visible when not connected */}
          {editingIg && (
            <div className="rounded-md border border-indigo-500/20 bg-indigo-500/5 px-3 py-2 flex flex-wrap gap-x-3 gap-y-1">
              <span className="text-[11px] text-muted-foreground">• Conta <span className="text-foreground">Business</span></span>
              <span className="text-[11px] text-muted-foreground">• Vinculada a uma <span className="text-foreground">Página do Facebook</span></span>
              <span className="text-[11px] text-muted-foreground">• Login via Facebook/Meta</span>
            </div>
          )}

          {editingIg ? (
            <>
              {/* OAuth button (only when app is configured) */}
              {HAS_OAUTH && igAccounts.length === 0 && (
                <a href="/api/integrations/instagram/oauth" className="block">
                  <Button
                    type="button"
                    className="w-full gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white border-0"
                    disabled={igPendingLoading}
                  >
                    {igPendingLoading
                      ? <RefreshCw className="h-4 w-4 animate-spin" />
                      : <LogIn className="h-4 w-4" />}
                    Entrar com Instagram
                  </Button>
                </a>
              )}

              {/* Account picker (after OAuth with multiple accounts) */}
              {igAccounts.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Selecione a conta do Instagram</label>
                  <div className="space-y-1">
                    {igAccounts.map((acc) => (
                      <button key={acc.instagramId} type="button"
                        onClick={() => { setIgBizId(acc.instagramId); setIgPageId(acc.pageId); setIgSelectedName(acc.instagramName); setIgToken(acc.pageToken); }}
                        className={`w-full text-left rounded-md border px-3 py-2 text-xs transition-colors ${igBizId === acc.instagramId ? "border-gold-500/60 bg-gold-500/10 text-foreground" : "border-border bg-surface-800 text-muted-foreground hover:text-foreground"}`}
                      >
                        <span className="font-medium">@{acc.instagramName}</span>
                        <span className="ml-2 text-[11px] opacity-60">via {acc.pageName}</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    {displayBizId && (
                      <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setEditingIg(false); setIgAccounts([]); fetch("/api/integrations/instagram/pending", { method: "DELETE" }); }}>Cancelar</Button>
                    )}
                    <Button size="sm" onClick={handleSaveInstagram} disabled={savingIg || !igToken || !igBizId} className="text-xs ml-auto">
                      {savingIg ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Conectar conta selecionada"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Separator + manual fallback toggle */}
              {igAccounts.length === 0 && (
                <>
                  {HAS_OAUTH && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 border-t border-border/40" />
                      <button
                        type="button"
                        onClick={() => setShowManualFallback((v) => !v)}
                        className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showManualFallback ? "ocultar token manual" : "inserir token manualmente"}
                      </button>
                      <div className="flex-1 border-t border-border/40" />
                    </div>
                  )}

                  {(!HAS_OAUTH || showManualFallback) && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Page Access Token</label>
                        <div className="flex gap-2">
                          <input
                            value={igToken} onChange={(e) => { setIgToken(e.target.value); setIgAccounts([]); }}
                            placeholder="EAAG..."
                            className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground"
                          />
                          <Button size="sm" variant="outline" onClick={handleDiscoverInstagram} disabled={!igToken || discovering} className="text-xs shrink-0">
                            {discovering ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Buscar"}
                          </Button>
                        </div>
                      </div>
                      {igBizId && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">Instagram Business ID</label>
                            <input value={igBizId} onChange={(e) => setIgBizId(e.target.value)} placeholder="ex: 1784..."
                              className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">Page ID (opcional)</label>
                            <input value={igPageId} onChange={(e) => setIgPageId(e.target.value)} placeholder="ID da página do Facebook"
                              className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground" />
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        {displayBizId && (
                          <Button size="sm" variant="ghost" className="text-xs" onClick={() => setEditingIg(false)}>Cancelar</Button>
                        )}
                        <Button size="sm" onClick={handleSaveInstagram} disabled={savingIg || !igToken || !igBizId} className="text-xs ml-auto">
                          {savingIg ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Salvar Instagram"}
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Cole o token e clique em &quot;Buscar&quot; para detectar o Instagram Business ID automaticamente.</p>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <div className="rounded-md border border-green-500/30 bg-green-500/8 px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                <div className="text-xs space-y-0.5 min-w-0">
                  <p className="font-semibold text-green-400">Conectado</p>
                  {displayUsername && (
                    <p className="text-foreground font-medium truncate">
                      <a href={`https://instagram.com/${displayUsername}`} target="_blank" rel="noopener noreferrer"
                        className="text-indigo-400 hover:text-indigo-300 hover:underline transition-colors">
                        @{displayUsername}
                      </a>
                    </p>
                  )}
                  <p className="text-muted-foreground truncate">Business ID: <span className="font-mono text-foreground/70">{displayBizId}</span></p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setEditingIg(true)}>
                  <Settings className="h-3.5 w-3.5" /> Editar
                </Button>
                <Button size="sm" variant="ghost" className="text-xs gap-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20"
                  onClick={handleDisconnectInstagram} disabled={disconnectingIg} title="Desconectar Instagram">
                  {disconnectingIg ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── WhatsApp ──────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-500/10 border border-green-500/20">
                <Plug className="h-5 w-5 text-green-400" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base">WhatsApp Business</CardTitle>
                <p className="text-xs text-muted-foreground">Envio de mensagens automáticas para clientes</p>
              </div>
            </div>
            <Badge variant={waConfigured ? "success" : "outline"} className="text-xs self-start sm:self-auto">
              {waConfigured ? "Conectado" : "Não configurado"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {waEditing ? (
            <>
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

              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground">2. Cole suas credenciais da Meta</p>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Access Token (permanente)</label>
                  <input value={waToken} onChange={(e) => setWaToken(e.target.value)} placeholder="EAAGm..."
                    className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Phone Number ID</label>
                  <input value={waPhoneId} onChange={(e) => setWaPhoneId(e.target.value)} placeholder="ex: 123456789012345"
                    className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground" />
                </div>
              </div>

              <div className="flex gap-2">
                <Button size="sm" className="text-xs" onClick={handleSaveWhatsApp} disabled={waSaving || !waToken || !waPhoneId}>
                  {waSaving ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : null}
                  Salvar
                </Button>
                {waConfigured && (
                  <Button size="sm" variant="ghost" className="text-xs" onClick={() => setWaEditing(false)}>Cancelar</Button>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-3">
              {/* Credenciais configuradas */}
              <div className="rounded-md border border-green-500/30 bg-green-500/8 px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                  <p className="text-xs font-semibold text-green-400">Credenciais configuradas</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="outline" className="text-xs gap-1 shrink-0"
                    onClick={() => { setWaEditing(true); handleLoadWaSetup(); }}>
                    <Settings className="h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button size="sm" variant="ghost" className="text-xs gap-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20"
                    onClick={handleDisconnectWhatsApp} disabled={disconnectingWa} title="Desconectar WhatsApp">
                    {disconnectingWa ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              {/* Seção de Templates — separada e sempre editável */}
              <div className="rounded-md border border-border bg-surface-800/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-foreground">Templates de mensagem</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Configure o WABA ID para importar templates aprovados da Meta
                    </p>
                  </div>
                  {!wabaEditing && (
                    <Button size="sm" variant="ghost" className="text-xs gap-1 shrink-0"
                      onClick={() => setWabaEditing(true)}>
                      <Settings className="h-3.5 w-3.5" /> {wabaId ? "Editar" : "Configurar"}
                    </Button>
                  )}
                </div>

                {wabaEditing ? (
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">WABA ID</label>
                      <input
                        value={wabaId}
                        onChange={(e) => setWabaId(e.target.value)}
                        placeholder="ex: 102938475665544"
                        className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground"
                      />
                      <p className="text-[10px] text-muted-foreground/60">Meta Business Manager → Contas → WhatsApp → ID da conta</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="text-xs" onClick={handleSaveWaba} disabled={wabaSaving}>
                        {wabaSaving ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : null}
                        Salvar
                      </Button>
                      <Button size="sm" variant="ghost" className="text-xs" onClick={() => setWabaEditing(false)}>Cancelar</Button>
                    </div>
                  </div>
                ) : wabaId ? (
                  <div className="flex items-center justify-between gap-3">
                    <code className="text-xs text-muted-foreground font-mono">{wabaId}</code>
                    <Button size="sm" variant="outline" className="text-xs gap-1 shrink-0"
                      onClick={handleSyncTemplates} disabled={wabaSyncing}>
                      {wabaSyncing
                        ? <RefreshCw className="h-3 w-3 animate-spin" />
                        : <RefreshCw className="h-3 w-3" />}
                      Sincronizar templates
                    </Button>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground/60">WABA ID não configurado — clique em Configurar para adicionar</p>
                )}

                {wabaSyncMsg && (
                  <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> {wabaSyncMsg}
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
