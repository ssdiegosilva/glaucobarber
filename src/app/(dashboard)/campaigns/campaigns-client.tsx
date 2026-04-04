"use client";

import { useState, useEffect } from "react";
import type React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { relativeTime } from "@/lib/utils";
import { CalendarDays, CheckCircle2, ChevronDown, ChevronRight, Clock, Copy, Download, ExternalLink, Globe, Megaphone, Palette, Pencil, Send, Settings, Trash2, Wand2, Sparkles, X, XCircle, Tag } from "lucide-react";
import Link from "next/link";

const STATUS_LABEL: Record<string, string> = { GENERATING: "Criando...", DRAFT: "Rascunho", APPROVED: "Aprovada", DISMISSED: "Dispensada", SCHEDULED: "Agendada", PUBLISHED: "Publicada" };
const STATUS_VARIANT: Record<string, string> = { GENERATING: "outline", DRAFT: "outline", APPROVED: "default", DISMISSED: "secondary", SCHEDULED: "info", PUBLISHED: "success" };
const STATUS_ICON: Record<string, React.ReactElement> = {
  GENERATING: <Sparkles className="h-3 w-3 animate-spin" />,
  DRAFT: <Clock className="h-3 w-3" />,
  APPROVED: <CheckCircle2 className="h-3 w-3" />,
  DISMISSED: <XCircle className="h-3 w-3" />,
  SCHEDULED: <Clock className="h-3 w-3" />,
  PUBLISHED: <Send className="h-3 w-3" />,
};

export interface OfferOption {
  id:        string;
  title:     string;
  salePrice: number;
  type:      string;
}

export interface CampaignDto {
  id: string;
  title: string;
  objective?: string;
  text: string;
  artBriefing: string | null;
  status: string;
  channel: string | null;
  createdAt: string | Date;
  publishedAt: string | Date | null;
  scheduledAt: string | null;
  imageUrl: string | null;
  instagramPermalink: string | null;
}

// ── LaunchCountdown ───────────────────────────────────────────

function useSecondsUntil(scheduledAt: string | null): number | null {
  const [secs, setSecs] = useState<number | null>(() => {
    if (!scheduledAt) return null;
    return Math.floor((new Date(scheduledAt).getTime() - Date.now()) / 1000);
  });
  useEffect(() => {
    if (!scheduledAt) return;
    const tick = () => {
      setSecs(Math.floor((new Date(scheduledAt).getTime() - Date.now()) / 1000));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [scheduledAt]);
  return secs;
}

function LaunchCountdown({ scheduledAt }: { scheduledAt: string }) {
  const secs = useSecondsUntil(scheduledAt);
  if (secs === null) return null;

  if (secs > 0) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    const label = h > 0
      ? `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`
      : `${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono font-semibold text-amber-400 tabular-nums shrink-0">
        <Clock className="h-2.5 w-2.5 shrink-0" /> {label}
      </span>
    );
  }

  // Countdown reached zero — waiting for the cron bus
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-green-500/40 bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold text-green-400 shrink-0 animate-pulse">
      <Send className="h-2.5 w-2.5 shrink-0" /> Na fila — chega em até 15 min 🚌
    </span>
  );
}

// ── ApproveModal ──────────────────────────────────────────────

function ApproveModal({
  onClose, onScheduled, loading,
}: {
  onClose:     () => void;
  onScheduled: (date: Date) => void;
  loading:     boolean;
}) {
  const [mode, setMode] = useState<"today" | "date">("today");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const today = new Date().toISOString().slice(0, 10);

  function confirm() {
    if (mode === "today") {
      onScheduled(new Date());
    } else {
      if (!date) return;
      onScheduled(new Date(`${date}T${time}:00`));
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-50" onClick={onClose} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[60] rounded-xl border border-border bg-card shadow-2xl p-5 space-y-4 max-w-sm mx-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Quando lançar esta campanha?</h3>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => setMode("today")}
            className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
              mode === "today" ? "border-gold-500/40 bg-gold-500/10" : "border-border hover:border-border/60"
            }`}
          >
            <Send className={`h-4 w-4 shrink-0 ${mode === "today" ? "text-gold-400" : "text-muted-foreground"}`} />
            <div>
              <p className="text-sm font-medium text-foreground">Lançar hoje</p>
              <p className="text-[11px] text-muted-foreground">Entra na fila e pode ser enviado agora</p>
            </div>
          </button>

          <button
            onClick={() => setMode("date")}
            className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
              mode === "date" ? "border-gold-500/40 bg-gold-500/10" : "border-border hover:border-border/60"
            }`}
          >
            <CalendarDays className={`h-4 w-4 shrink-0 ${mode === "date" ? "text-gold-400" : "text-muted-foreground"}`} />
            <div>
              <p className="text-sm font-medium text-foreground">Agendar para outra data</p>
              <p className="text-[11px] text-muted-foreground">Publicado automaticamente na data escolhida</p>
            </div>
          </button>

          {mode === "date" && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Data</label>
                <input
                  type="date" value={date} min={today}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Horário</label>
                <input
                  type="time" value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button
            className="flex-1"
            onClick={confirm}
            disabled={loading || (mode === "date" && !date)}
          >
            {loading ? "Agendando..." : "Confirmar"}
          </Button>
        </div>
      </div>
    </>
  );
}

// ── RescheduleModal ───────────────────────────────────────────

function RescheduleModal({
  current, onClose, onSave,
}: {
  current: string | null;
  onClose: () => void;
  onSave:  (date: Date) => void;
}) {
  const today   = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(current ? current.slice(0, 10) : today);
  const [time, setTime] = useState(current ? current.slice(11, 16) : "09:00");

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-50" onClick={onClose} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[60] rounded-xl border border-border bg-card shadow-2xl p-5 space-y-4 max-w-xs mx-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Alterar data de lançamento</h3>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Data</label>
            <input
              type="date" value={date} min={today}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Horário</label>
            <input
              type="time" value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1" onClick={() => { onSave(new Date(`${date}T${time}:00`)); }} disabled={!date}>
            Salvar
          </Button>
        </div>
      </div>
    </>
  );
}

// ── Main client ───────────────────────────────────────────────

export function CampaignsClient({ campaigns: initial, instagramConfigured, hasBrandStyle = false, availableOffers = [], imageCreditCost = 10 }: {
  campaigns: CampaignDto[];
  instagramConfigured: boolean;
  hasBrandStyle?: boolean;
  availableOffers?: OfferOption[];
  imageCreditCost?: number;
}) {
  const [campaigns, setCampaigns] = useState<CampaignDto[]>(initial);
  const [expandedPublished, setExpandedPublished] = useState<string | null>(null);

  const [theme, setTheme] = useState("");
  const [selectedOfferId, setSelectedOfferId] = useState<string>("");
  const [loadingThemes, setLoadingThemes] = useState(false);
  const [suggestedThemes, setSuggestedThemes] = useState<{ title: string; description: string }[]>([]);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [generatingImage, setGeneratingImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [imagePrompt, setImagePrompt]       = useState<Record<string, string>>({});
  const [approveModal, setApproveModal]     = useState<string | null>(null); // campaignId
  const [rescheduleModal, setRescheduleModal] = useState<string | null>(null);
  const [schedulingId, setSchedulingId]     = useState<string | null>(null);
  const [editingText, setEditingText]       = useState<string | null>(null);
  const [editedText, setEditedText]         = useState<Record<string, string>>({});
  const [savingText, setSavingText]         = useState<string | null>(null);

  async function createCampaign() {
    if (!theme) return;

    // Request browser notification permission before starting (non-blocking)
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    // Snapshot values and clear the form immediately so user can start another
    const currentTheme   = theme;
    const currentOfferId = selectedOfferId;
    const tempId         = `generating-${Date.now()}`;

    const placeholder: CampaignDto = {
      id:                 tempId,
      title:              currentTheme,
      status:             "GENERATING",
      text:               "",
      artBriefing:        null,
      channel:            "instagram",
      createdAt:          new Date().toISOString(),
      publishedAt:        null,
      scheduledAt:        null,
      imageUrl:           null,
      instagramPermalink: null,
    };

    setCampaigns((prev) => [placeholder, ...prev]);
    setTheme("");
    setSelectedOfferId("");
    setSuggestedThemes([]);

    toast({
      title: "Solicitação acatada!",
      description: "Vamos criar sua campanha — quando estiver pronta, você será avisado no sininho 🔔",
    });

    // Fire request — UI não fica bloqueada, placeholder já está visível
    try {
      const res = await fetch("/api/campaigns", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ theme: currentTheme, channel: "instagram", offerId: currentOfferId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao criar campanha");

      // Substitui placeholder pelo card real
      setCampaigns((prev) => prev.map((c) => c.id === tempId ? data.campaign : c));

      window.dispatchEvent(new Event("notifications-changed"));
      window.dispatchEvent(new Event("ai-used"));

      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        new Notification("Campanha pronta! ✨", {
          body: `"${data.campaign.title}" está aguardando sua aprovação.`,
          icon: "/favicon.ico",
        });
      }
    } catch (e) {
      // Remove placeholder e mostra erro
      setCampaigns((prev) => prev.filter((c) => c.id !== tempId));
      toast({ title: "Erro ao criar campanha", description: String(e), variant: "destructive" });
    }
  }

  async function fetchThemes() {
    setLoadingThemes(true);
    setSuggestedThemes([]);
    try {
      const res = await fetch("/api/campaigns/themes", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao buscar temas");
      window.dispatchEvent(new Event("ai-used"));
      setSuggestedThemes(data.themes ?? []);
      if (!data.themes?.length) toast({ title: "Nenhum tema encontrado", description: "Tente novamente mais tarde." });
    } catch (e) {
      toast({ title: "Erro", description: String(e), variant: "destructive" });
    } finally {
      setLoadingThemes(false);
    }
  }

  async function setStatus(id: string, status: string) {
    const res = await fetch(`/api/campaigns/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    const data = await res.json();
    if (!res.ok) { toast({ title: "Erro", description: data.error ?? "Não foi possível atualizar" }); return; }
    setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
  }

  async function publish(id: string) {
    setPublishingId(id);
    try {
      const campaign = campaigns.find((c) => c.id === id);
      if (!campaign?.imageUrl?.trim()) {
        toast({ title: "Falta a arte", description: "Envie ou gere uma imagem antes de publicar.", variant: "destructive" });
        return;
      }
      const res = await fetch(`/api/campaigns/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: campaign?.imageUrl ?? null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao publicar");
      setCampaigns((prev) => prev.map((c) => c.id === id
        ? { ...c, status: "PUBLISHED", imageUrl: null, publishedAt: new Date().toISOString(), instagramPermalink: data.permalink ?? null }
        : c
      ));
      toast({ title: "Publicado no Instagram!", description: "Campanha enviada com sucesso." });
    } catch (e) {
      const msg = String(e);
      if (msg.includes("Instagram não configurado") || msg.includes("IG_NOT_CONFIGURED")) {
        toast({ title: "Configure o Instagram", description: "Salve o Page Access Token e o Instagram Business ID na aba Integrações.", variant: "destructive" });
      } else {
        toast({ title: "Erro ao publicar", description: msg, variant: "destructive" });
      }
    } finally {
      setPublishingId(null);
    }
  }

  async function saveImage(id: string, imageUrl: string, opts?: { silent?: boolean }) {
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar imagem");
      setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, imageUrl } : c)));
      if (!opts?.silent) toast({ title: "Imagem salva", description: "Arte anexada à campanha." });
    } catch (e) {
      toast({ title: "Erro ao salvar imagem", description: String(e), variant: "destructive" });
    }
  }

  async function uploadImage(id: string, file: File) {
    setUploadingImage(id);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("campaignId", id);

      const res = await fetch("/api/uploads/campaign-image", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível enviar a imagem");

      await saveImage(id, data.url, { silent: true });
      toast({ title: "Imagem enviada", description: "Arte anexada à campanha." });
    } catch (e) {
      toast({ title: "Erro ao enviar imagem", description: String(e), variant: "destructive" });
    } finally {
      setUploadingImage(null);
    }
  }

  async function generateImage(id: string, promptOverride?: string) {
    setGeneratingImage(id);
    try {
      const res = await fetch(`/api/campaigns/${id}/image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptOverride: promptOverride || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao gerar imagem");
      window.dispatchEvent(new Event("ai-used"));
      setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, imageUrl: data.url } : c)));
      toast({ title: "Imagem gerada", description: "Arte criada via IA." });
      setEditingImage(null);
    } catch (e) {
      toast({ title: "Erro ao gerar imagem", description: String(e), variant: "destructive" });
    } finally {
      setGeneratingImage(null);
    }
  }

  async function scheduleFor(id: string, scheduledAt: Date) {
    setSchedulingId(id);
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: "SCHEDULED", scheduledAt: scheduledAt.toISOString() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao agendar");
      setCampaigns((prev) => prev.map((c) =>
        c.id === id ? { ...c, status: "SCHEDULED", scheduledAt: scheduledAt.toISOString() } : c
      ));
      const isToday = scheduledAt.toDateString() === new Date().toDateString();
      toast({ title: "Campanha agendada", description: isToday ? "Pronta para envio — aparece na fila" : `Agendada para ${scheduledAt.toLocaleDateString("pt-BR")}` });
    } catch (e) {
      toast({ title: "Erro ao agendar", description: String(e), variant: "destructive" });
    } finally {
      setSchedulingId(null);
    }
  }

  async function saveText(id: string) {
    const text = editedText[id];
    if (text === undefined) return;
    setSavingText(id);
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar texto");
      setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, text } : c)));
      setEditingText(null);
      toast({ title: "Texto salvo", description: "Copy da campanha atualizado." });
    } catch (e) {
      toast({ title: "Erro ao salvar texto", description: String(e), variant: "destructive" });
    } finally {
      setSavingText(null);
    }
  }

  async function remove(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Erro", description: data.error ?? "Não foi possível deletar" , variant: "destructive"});
        return;
      }
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
      toast({ title: "Campanha deletada", description: "Removida com sucesso." });
    } catch (e) {
      toast({ title: "Erro", description: String(e), variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  }

  // ── Helpers ────────────────────────────────────────────────
  const generatingCampaigns = campaigns.filter((c) => c.status === "GENERATING");
  const queueCampaigns      = campaigns.filter((c) => ["SCHEDULED", "APPROVED"].includes(c.status));
  const draftCampaigns      = campaigns.filter((c) => c.status === "DRAFT");
  const dismissedCampaigns  = campaigns.filter((c) => c.status === "DISMISSED");

  function isToday(dateStr: string | null) {
    if (!dateStr) return false;
    return new Date(dateStr).toDateString() === new Date().toDateString();
  }

  function formatScheduled(dateStr: string | null) {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  // ── Generating skeleton card ───────────────────────────────
  function GeneratingCard({ c }: { c: CampaignDto }) {
    return (
      <Card id={`campaign-${c.id}`} className="scroll-mt-20 border-purple-500/20 bg-purple-500/5">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-sm leading-snug text-foreground/80">{c.title}</CardTitle>
            <Badge variant="outline" className="shrink-0 flex items-center gap-1 text-purple-400 border-purple-400/30">
              <Sparkles className="h-3 w-3 animate-spin" />
              Criando...
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border border-dashed border-purple-500/20 bg-surface-900 h-44 flex flex-col items-center justify-center gap-3">
            <div className="relative">
              <div className="h-10 w-10 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
              <Sparkles className="h-4 w-4 text-purple-400/60 absolute inset-0 m-auto" />
            </div>
            <p className="text-xs text-muted-foreground/70">Gerando arte com IA...</p>
          </div>
          <div className="space-y-2 animate-pulse">
            <div className="h-2.5 bg-surface-700 rounded w-full" />
            <div className="h-2.5 bg-surface-700 rounded w-4/5" />
            <div className="h-2.5 bg-surface-700 rounded w-3/5" />
          </div>
          <p className="text-[11px] text-muted-foreground/50 text-center">
            Você será notificado quando estiver pronta 🔔
          </p>
        </CardContent>
      </Card>
    );
  }

  // ── Campaign card (reused for DRAFT and DISMISSED) ─────────
  function CampaignCard({ c }: { c: CampaignDto }) {
    return (
      <Card id={`campaign-${c.id}`} key={c.id} className="scroll-mt-20">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-sm leading-snug">{c.title}</CardTitle>
            <Badge variant={STATUS_VARIANT[c.status] as any} className="shrink-0 flex items-center gap-1">
              {STATUS_ICON[c.status]}
              {STATUS_LABEL[c.status]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Copy</p>
              {editingText !== c.id && (
                <button
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                  title="Editar texto"
                  onClick={(e) => { e.stopPropagation(); setEditedText((prev) => ({ ...prev, [c.id]: c.text })); setEditingText(c.id); }}
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
            </div>
            {editingText === c.id ? (
              <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                <textarea
                  value={editedText[c.id] ?? c.text}
                  onChange={(e) => setEditedText((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  rows={6}
                  className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-xs text-foreground leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setEditingText(null)} disabled={savingText === c.id}>Cancelar</Button>
                  <Button size="sm" className="h-7 text-[11px]" onClick={() => saveText(c.id)} disabled={savingText === c.id}>
                    {savingText === c.id ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">{c.text}</p>
            )}
          </div>
          {c.artBriefing && (
            <div className="rounded-md bg-surface-800 p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Briefing da arte</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{c.artBriefing}</p>
            </div>
          )}
          <div className="space-y-3">
            {(() => {
              const openEditor = !c.imageUrl || editingImage === c.id;
              return (
                <div className="rounded-lg border border-dashed border-gold-500/30 bg-surface-900">
                  <div className="flex items-center justify-between px-3 py-2">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Arte</p>
                      <p className="text-[11px] text-muted-foreground">Pré-visualize, aprove ou troque a imagem.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.imageUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] gap-1.5"
                          onClick={(e) => { e.stopPropagation(); setEditingImage(openEditor ? null : c.id); }}
                        >
                          {openEditor ? <><X className="h-3 w-3" />Fechar</> : <><Wand2 className="h-3 w-3" />Mudar imagem</>}
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="bg-surface-800">
                    {c.imageUrl ? (
                      <img src={c.imageUrl} alt={`Arte da campanha ${c.title}`} className="w-full h-60 object-cover" />
                    ) : (
                      <div className="h-60 flex items-center justify-center text-[11px] text-muted-foreground">Nenhuma imagem ainda</div>
                    )}
                  </div>
                  {c.imageUrl && (
                    <div className="flex items-center justify-between px-3 py-2 text-[11px] text-muted-foreground">
                      <span>Prévia renderizada</span>
                      <a
                        href={c.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-gold-400 hover:text-gold-300 underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Abrir em nova aba
                      </a>
                    </div>
                  )}

                  {(openEditor) && (
                    <div className="space-y-2 px-3 py-3 border-t border-border/40">
                      <label className="text-[11px] text-muted-foreground">Texto para gerar a arte (opcional)</label>
                      <input
                        value={imagePrompt[c.id] ?? ""}
                        onChange={(e) => setImagePrompt((prev) => ({ ...prev, [c.id]: e.target.value }))}
                        placeholder="Ex: corte premium com iluminação dramática"
                        className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-xs"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex flex-wrap gap-2">
                        <input
                          id={`upload-${c.id}`}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadImage(c.id, file);
                            e.target.value = "";
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-[11px]"
                          onClick={(e) => { e.stopPropagation(); document.getElementById(`upload-${c.id}`)?.click(); }}
                          disabled={uploadingImage === c.id}
                        >
                          {uploadingImage === c.id ? "Enviando..." : "Enviar do celular"}
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 text-[11px] gap-1.5 border border-purple-500/40 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 shadow-none"
                          disabled={generatingImage === c.id}
                          onClick={(e) => { e.stopPropagation(); generateImage(c.id, imagePrompt[c.id]); }}
                        >
                          {generatingImage === c.id
                            ? <><Sparkles className="h-3 w-3 animate-spin" />Gerando...</>
                            : <><Sparkles className="h-3 w-3" />Gerar com IA</>}
                        </Button>
                      </div>
                      {!hasBrandStyle && (
                        <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                          <Palette className="h-3 w-3 text-purple-400/60 shrink-0" />
                          Sem estilo configurado — a imagem usará padrão genérico.{" "}
                          <Link href="/settings" className="text-purple-400/80 hover:text-purple-400 underline underline-offset-2" onClick={(e) => e.stopPropagation()}>
                            Configurar
                          </Link>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Instagram not configured notice */}
            {!instagramConfigured && c.status === "APPROVED" && (
              <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2 flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-amber-400 font-medium">Instagram não conectado</p>
                  <p className="text-[10px] text-amber-400/70 mt-0.5">Configure para publicar diretamente, ou copie o texto e salve a imagem para postar manualmente.</p>
                </div>
                <a
                  href="/integrations"
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 rounded p-1.5 hover:bg-amber-500/20 text-amber-400 transition-colors"
                  title="Configurar integrações"
                >
                  <Settings className="h-4 w-4" />
                </a>
              </div>
            )}

            {/* Copy text + Save image row */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[11px] gap-1.5 text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(c.text).then(() =>
                    toast({ title: "Texto copiado!", description: "Cole no Instagram ou onde preferir." })
                  );
                }}
              >
                <Copy className="h-3 w-3" />
                Copiar texto
              </Button>
              {c.imageUrl && (
                <a
                  href={c.imageUrl}
                  download={`campanha-${c.id}.jpg`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <Download className="h-3 w-3" />
                  Salvar imagem
                </a>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {c.channel && <Badge variant="outline" className="text-[10px]">{c.channel}</Badge>}
                <span className="text-[10px] text-muted-foreground">{relativeTime(c.createdAt)}</span>
              </div>
              <div className="flex gap-2">
                {c.status === "DRAFT" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    onClick={(e) => { e.stopPropagation(); setApproveModal(c.id); }}
                  >
                    Aprovar
                  </Button>
                )}
                {c.status !== "PUBLISHED" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[11px]"
                    onClick={(e) => { e.stopPropagation(); remove(c.id); }}
                    disabled={deletingId === c.id}
                  >
                    {deletingId === c.id ? "Deletando..." : "Deletar"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── Approve modal ──────────────────────────────────── */}
      {approveModal && (
        <ApproveModal
          onClose={() => setApproveModal(null)}
          onScheduled={(date) => { scheduleFor(approveModal, date); setApproveModal(null); }}
          loading={schedulingId === approveModal}
        />
      )}

      {/* ── Reschedule modal ───────────────────────────────── */}
      {rescheduleModal && (
        <RescheduleModal
          current={campaigns.find((c) => c.id === rescheduleModal)?.scheduledAt ?? null}
          onClose={() => setRescheduleModal(null)}
          onSave={(date) => { scheduleFor(rescheduleModal, date); setRescheduleModal(null); }}
        />
      )}

      {!hasBrandStyle && (
        <div className="flex items-center gap-3 rounded-xl border border-purple-500/25 bg-purple-500/8 px-4 py-3">
          <div className="shrink-0 h-7 w-7 rounded-lg bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
            <Palette className="h-3.5 w-3.5 text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground">Defina o estilo visual da sua marca</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Sem estilo configurado, as imagens geradas usam um padrão genérico. Configure uma vez e todas as campanhas refletem sua identidade.
            </p>
          </div>
          <Link
            href="/settings"
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-[11px] font-medium text-purple-400 hover:bg-purple-500/20 transition-colors"
          >
            <Sparkles className="h-3 w-3" /> Configurar
          </Link>
        </div>
      )}

      <Card className="border-gold-500/20 bg-gradient-to-br from-surface-900 to-surface-800/60">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-2 shrink-0">
              <Wand2 className="h-4 w-4 text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-sm text-foreground">Criar campanha com IA</CardTitle>
              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                A IA escreve o texto da campanha, sugere a arte e prepara tudo para publicar no Instagram. Você só precisa dizer o tema — ela cuida do resto.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-muted-foreground font-medium">Tema da campanha</label>
              <button
                type="button"
                onClick={fetchThemes}
                disabled={loadingThemes || loadingCreate}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-400 hover:text-purple-300 disabled:opacity-50 transition-colors"
              >
                {loadingThemes ? (
                  <><Sparkles className="h-3 w-3 animate-spin" />Buscando tendências...</>
                ) : (
                  <><Globe className="h-3 w-3" />Sem ideia? Veja tendências</>
                )}
              </button>
            </div>
            <input
              value={theme}
              onChange={(e) => { setTheme(e.target.value); if (suggestedThemes.length) setSuggestedThemes([]); }}
              placeholder="Ex: Tarde com horários livres, Dia dos Pais, Promoção relâmpago..."
              className="w-full rounded-md border border-border bg-surface-800/80 px-3 py-2 text-xs placeholder:text-muted-foreground/60"
              />
          </div>
          {suggestedThemes.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Temas em alta esta semana</p>
              <div className="grid gap-1.5">
                {suggestedThemes.map((t, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { setTheme(t.title); setSuggestedThemes([]); }}
                    className="w-full flex items-start gap-2.5 rounded-lg border border-purple-500/20 bg-purple-500/5 px-3 py-2 text-left hover:border-purple-500/40 hover:bg-purple-500/10 transition-colors group"
                  >
                    <Sparkles className="h-3 w-3 text-purple-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground group-hover:text-purple-300 transition-colors">{t.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{t.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {availableOffers.length > 0 && (
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                <Tag className="h-3 w-3 text-amber-400" /> Vincular oferta (opcional)
              </label>
              <select
                value={selectedOfferId}
                onChange={(e) => setSelectedOfferId(e.target.value)}
                className="w-full rounded-md border border-border bg-surface-800/80 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Sem oferta vinculada</option>
                {availableOffers.map((o) => (
                  <option key={o.id} value={o.id}>{o.title} — R$ {o.salePrice.toFixed(2)}</option>
                ))}
              </select>
              {selectedOfferId && (
                <p className="text-[10px] text-amber-400/70">A IA vai mencionar esta oferta no texto da campanha.</p>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Button
                onClick={createCampaign}
                disabled={!theme}
                className="text-xs gap-2 font-semibold bg-purple-600 hover:bg-purple-500 text-white"
              >
                <Wand2 className="h-3.5 w-3.5" />
                Gerar campanha com IA
              </Button>
              {!instagramConfigured && (
                <p className="text-[11px] text-amber-400/80">Instagram não conectado — <a href="/integrations" className="underline">configurar</a></p>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
              <span>💡</span>
              Usa {1 + imageCreditCost} créditos de IA (1 texto + {imageCreditCost} imagem) — pode criar várias ao mesmo tempo
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Campanhas sendo geradas ────────────────────────── */}
      {generatingCampaigns.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-0.5">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-purple-400 animate-pulse" />
              Criando agora
            </p>
            <span className="rounded-full border border-purple-500/30 px-2 py-0.5 text-[10px] text-purple-400">{generatingCampaigns.length}</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {generatingCampaigns.map((c) => <GeneratingCard key={c.id} c={c} />)}
          </div>
        </div>
      )}

      {/* ── Campanhas aguardando aprovação ─────────────────── */}
      {draftCampaigns.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-0.5">
            <p className="text-xs font-semibold text-foreground">Aguardando aprovação</p>
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">{draftCampaigns.length}</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {draftCampaigns.map((c) => <CampaignCard key={c.id} c={c} />)}
          </div>
        </div>
      )}

      {/* ── Fila de lançamento ─────────────────────────────── */}
      {queueCampaigns.length > 0 && (
        <Card className="border-gold-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-gold-400" />
              Fila de lançamento
              <span className="ml-auto rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">{queueCampaigns.length}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {queueCampaigns.map((c) => {
                const today   = isToday(c.scheduledAt);
                const dateStr = formatScheduled(c.scheduledAt);
                return (
                  <div key={c.id} className={`px-4 py-3 ${today ? "bg-amber-500/5" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs font-semibold text-foreground truncate">{c.title}</p>
                          {today && c.scheduledAt && (
                            <LaunchCountdown scheduledAt={c.scheduledAt} />
                          )}
                          {!c.imageUrl && (
                            <span className="text-[10px] text-red-400/80 shrink-0">sem imagem</span>
                          )}
                        </div>
                        {dateStr ? (
                          <p className="text-[11px] text-muted-foreground mt-0.5">{dateStr}</p>
                        ) : (
                          <p className="text-[11px] text-amber-400/70 mt-0.5">Sem data definida</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          className="h-7 text-[11px] gap-1"
                          onClick={(e) => { e.stopPropagation(); publish(c.id); }}
                          disabled={!instagramConfigured || publishingId === c.id || !c.imageUrl}
                          title={!instagramConfigured ? "Configure o Instagram em Integrações" : !c.imageUrl ? "Adicione uma imagem primeiro" : undefined}
                        >
                          {publishingId === c.id ? <><Sparkles className="h-3 w-3 animate-spin" />Publicando...</> : <><Send className="h-3 w-3" />Enviar agora</>}
                        </Button>
                        <button
                          onClick={(e) => { e.stopPropagation(); if (editingText === c.id) { setEditingText(null); } else { setEditedText((prev) => ({ ...prev, [c.id]: c.text })); setEditingText(c.id); } }}
                          className={`rounded-md border p-1.5 transition-colors ${editingText === c.id ? "border-gold-500/40 text-gold-400 bg-gold-500/10" : "border-border text-muted-foreground hover:text-foreground hover:bg-surface-700"}`}
                          title="Editar texto"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setRescheduleModal(c.id); }}
                          className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-700 transition-colors"
                          title="Alterar data"
                        >
                          <CalendarDays className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); remove(c.id); }}
                          className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-red-400 hover:border-red-400/40 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    {editingText === c.id && (
                      <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                        <textarea
                          value={editedText[c.id] ?? c.text}
                          onChange={(e) => setEditedText((prev) => ({ ...prev, [c.id]: e.target.value }))}
                          rows={5}
                          className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-xs text-foreground leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setEditingText(null)} disabled={savingText === c.id}>Cancelar</Button>
                          <Button size="sm" className="h-7 text-[11px]" onClick={() => saveText(c.id)} disabled={savingText === c.id}>
                            {savingText === c.id ? "Salvando..." : "Salvar"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Published campaigns table */}
      {campaigns.some((c) => c.status === "PUBLISHED") && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Send className="h-4 w-4 text-green-400" /> Publicadas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {campaigns.filter((c) => c.status === "PUBLISHED").slice(0, 10).map((c) => (
                <div key={c.id}>
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-800/50 transition-colors"
                    onClick={() => setExpandedPublished(expandedPublished === c.id ? null : c.id)}
                  >
                    {expandedPublished === c.id
                      ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                    <span className="text-xs text-muted-foreground w-24 shrink-0">
                      {c.publishedAt ? new Date(c.publishedAt).toLocaleDateString("pt-BR") : relativeTime(c.createdAt)}
                    </span>
                    <span className="text-xs font-medium text-foreground flex-1 truncate">{c.title}</span>
                    {c.channel && <Badge variant="outline" className="text-[10px] shrink-0">{c.channel}</Badge>}
                  </button>
                  {expandedPublished === c.id && (
                    <div className="px-10 pb-4 space-y-2">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Título</p>
                      <p className="text-xs text-foreground">{c.title}</p>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider mt-2">Texto</p>
                      <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">{c.text}</p>
                      {c.instagramPermalink && (
                        <a
                          href={c.instagramPermalink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-gold-400 hover:text-gold-300 mt-2"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Ver post no Instagram
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Empty state ────────────────────────────────────── */}
      {draftCampaigns.length === 0 && dismissedCampaigns.length === 0 && !campaigns.some((c) => c.status === "PUBLISHED") && queueCampaigns.length === 0 && (
        <div className="rounded-xl border border-dashed border-gold-500/20 bg-card p-12 text-center">
          <Megaphone className="h-8 w-8 text-gold-400/50 mx-auto mb-3" />
          <h3 className="font-semibold text-foreground mb-1">Nenhuma campanha ainda</h3>
          <p className="text-sm text-muted-foreground">Crie uma campanha manual ou aprove uma sugestão da IA.</p>
        </div>
      )}

      {/* ── Campanhas dispensadas ──────────────────────────── */}
      {dismissedCampaigns.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-0.5">
            <p className="text-xs font-semibold text-muted-foreground">Dispensadas</p>
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">{dismissedCampaigns.length}</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {dismissedCampaigns.map((c) => <CampaignCard key={c.id} c={c} />)}
          </div>
        </div>
      )}
    </div>
  );
}
