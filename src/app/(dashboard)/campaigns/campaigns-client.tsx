"use client";

import { useState, useEffect } from "react";
import type React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { relativeTime } from "@/lib/utils";
import { isAiLimitError, triggerAiLimitModal } from "@/lib/ai-error";
import { Archive, CalendarDays, CheckCircle2, ChevronDown, ChevronRight, Clock, Copy, Download, ExternalLink, Gem, Globe, Megaphone, Palette, Pencil, Send, Settings, Star, Trash2, Wand2, Sparkles, X, XCircle, Tag, Zap } from "lucide-react";
import Link from "next/link";

const STATUS_LABEL: Record<string, string> = { GENERATING: "Criando...", DRAFT: "Rascunho", APPROVED: "Aprovada", DISMISSED: "Dispensada", SCHEDULED: "Agendada", PUBLISHED: "Publicada", FAILED: "Falhou", ARCHIVED: "Arquivada" };
const STATUS_VARIANT: Record<string, string> = { GENERATING: "outline", DRAFT: "outline", APPROVED: "default", DISMISSED: "secondary", SCHEDULED: "info", PUBLISHED: "success", FAILED: "destructive", ARCHIVED: "secondary" };
const STATUS_ICON: Record<string, React.ReactElement> = {
  GENERATING: <Sparkles className="h-3 w-3 animate-spin" />,
  DRAFT: <Clock className="h-3 w-3" />,
  APPROVED: <CheckCircle2 className="h-3 w-3" />,
  DISMISSED: <XCircle className="h-3 w-3" />,
  SCHEDULED: <Clock className="h-3 w-3" />,
  PUBLISHED: <Send className="h-3 w-3" />,
  FAILED: <XCircle className="h-3 w-3" />,
  ARCHIVED: <Archive className="h-3 w-3" />,
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
  errorMsg: string | null;
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

// ── GeneratingCard ────────────────────────────────────────────

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

// ── GenerateImageModal ────────────────────────────────────────

type ImageQualityTier = "low" | "medium" | "high";

const QUALITY_OPTIONS: { tier: ImageQualityTier; icon: React.ReactElement; label: string; desc: string }[] = [
  { tier: "low",    icon: <Zap className="h-5 w-5" />,  label: "Rascunho", desc: "Mais rápido"    },
  { tier: "medium", icon: <Star className="h-5 w-5" />, label: "Padrão",   desc: "Recomendado"    },
  { tier: "high",   icon: <Gem className="h-5 w-5" />,  label: "Premium",  desc: "Mais detalhado" },
];

function GenerateImageModal({
  generating,
  imageCreditCosts,
  briefing,
  onGenerate,
  onClose,
}: {
  generating: boolean;
  imageCreditCosts: { low: number; medium: number; high: number };
  briefing?: string | null;
  onGenerate: (prompt?: string, quality?: ImageQualityTier) => Promise<void>;
  onClose: () => void;
}) {
  const [quality, setQuality]                 = useState<ImageQualityTier>("medium");
  const [editingBriefing, setEditingBriefing] = useState(false);
  const [briefingText, setBriefingText]       = useState(briefing ?? "");
  const [imageError, setImageError]           = useState<{ message: string; isCredits: boolean } | null>(null);

  async function handleGenerate() {
    setImageError(null);
    try {
      await onGenerate(briefingText || undefined, quality);
    } catch (e: any) {
      const isCredits = e?.code === "insufficient_credits" || e?.code === "ai_limit";
      setImageError({ message: e?.message ?? "Erro ao gerar imagem. Tente novamente.", isCredits });
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-50" onClick={onClose} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[60] rounded-xl border border-border bg-card shadow-2xl p-5 space-y-4 max-w-sm mx-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-400" />
            Gerar imagem com IA
          </h3>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Briefing da arte */}
        {(briefingText || briefing) && (
          <div className="rounded-md bg-surface-800 border border-border p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Briefing da arte</p>
              <button
                onClick={() => setEditingBriefing((v) => !v)}
                className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                title="Editar briefing"
              >
                {editingBriefing ? <X className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
              </button>
            </div>
            {editingBriefing ? (
              <textarea
                value={briefingText}
                onChange={(e) => setBriefingText(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-border bg-surface-700 px-2.5 py-2 text-xs text-foreground leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
            ) : (
              <p className="text-xs text-muted-foreground leading-relaxed">{briefingText}</p>
            )}
          </div>
        )}

        {/* Quality — horizontal cards with icons */}
        <div className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground font-medium">Qualidade</p>
          <div className="grid grid-cols-3 gap-2">
            {QUALITY_OPTIONS.map(({ tier, icon, label, desc }) => {
              const active = quality === tier;
              return (
                <button
                  key={tier}
                  onClick={() => setQuality(tier)}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-colors ${
                    active
                      ? "border-purple-500/60 bg-purple-500/15"
                      : "border-border bg-surface-800 hover:border-zinc-600"
                  }`}
                >
                  <span className={active ? "text-purple-400" : "text-muted-foreground"}>{icon}</span>
                  <span className={`text-[11px] font-semibold leading-none ${active ? "text-purple-300" : "text-foreground"}`}>{label}</span>
                  <span className="text-[10px] text-muted-foreground leading-none mt-0.5">{desc}</span>
                  <span className={`text-[10px] leading-none mt-0.5 ${active ? "text-purple-400" : "text-muted-foreground/60"}`}>
                    {imageCreditCosts[tier]} créditos
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Inline error */}
        {imageError && (
          <div className="rounded-md bg-red-500/10 border border-red-500/30 px-3 py-2.5 space-y-2">
            <p className="text-xs text-red-400 leading-relaxed">{imageError.message}</p>
            {imageError.isCredits && (
              <Link
                href="/billing"
                onClick={onClose}
                className="inline-flex items-center gap-1 text-xs font-medium text-gold-400 hover:text-gold-300 underline underline-offset-2"
              >
                Comprar créditos extras →
              </Link>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={generating}>
            Cancelar
          </Button>
          <Button
            className="flex-1 bg-purple-600 hover:bg-purple-500 text-white gap-1.5"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating
              ? <><Sparkles className="h-3.5 w-3.5 animate-spin" />Gerando...</>
              : <><Sparkles className="h-3.5 w-3.5" />Gerar imagem</>}
          </Button>
        </div>
      </div>
    </>
  );
}

// ── CampaignCard ──────────────────────────────────────────────

interface CampaignCardProps {
  c: CampaignDto;
  uploadingImage: string | null;
  generatingImage: string | null;
  deletingId: string | null;
  hasBrandStyle: boolean;
  instagramConfigured: boolean;
  imageCreditCosts: { low: number; medium: number; high: number };
  onUploadImage: (id: string, file: File) => void;
  onGenerateImage: (id: string, prompt?: string, quality?: ImageQualityTier) => Promise<void>;
  onSaveText: (id: string, text: string) => Promise<void>;
  onRemove: (id: string) => void;
  onRestore?: (id: string) => void;
  onRepublish?: (id: string) => void;
  onApprove: (id: string) => void;
}

function CampaignCard({ c, uploadingImage, generatingImage, deletingId, hasBrandStyle, instagramConfigured, imageCreditCosts, onUploadImage, onGenerateImage, onSaveText, onRemove, onRestore, onRepublish, onApprove }: CampaignCardProps) {
  const [editingImage, setEditingImage] = useState(false);
  const [editingText, setEditingText] = useState(false);
  const [editedText, setEditedText] = useState(c.text);
  const [savingText, setSavingText] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  const openEditor = !c.imageUrl || editingImage;

  async function handleSaveText() {
    setSavingText(true);
    try {
      await onSaveText(c.id, editedText);
      setEditingText(false);
    } finally {
      setSavingText(false);
    }
  }

  async function handleGenerateImage(prompt?: string, quality?: ImageQualityTier) {
    await onGenerateImage(c.id, prompt, quality); // throws on error — modal catches it
    setEditingImage(false);
    setShowGenerateModal(false);
  }

  return (
    <Card id={`campaign-${c.id}`} className="scroll-mt-20">
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
            {!editingText && (
              <button
                className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                title="Editar texto"
                onClick={(e) => { e.stopPropagation(); setEditedText(c.text); setEditingText(true); }}
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>
          {editingText ? (
            <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                rows={6}
                className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-xs text-foreground leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setEditingText(false)} disabled={savingText}>Cancelar</Button>
                <Button size="sm" className="h-7 text-[11px]" onClick={handleSaveText} disabled={savingText}>
                  {savingText ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">{c.text}</p>
          )}
        </div>
        <div className="space-y-3">
          <div className="rounded-lg border border-dashed border-gold-500/30 bg-surface-900">
            {/* Image preview — only shown when there's already an image */}
            {c.imageUrl && (
              <>
                <div className="flex items-center justify-between px-3 py-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Arte</p>
                    <p className="text-[11px] text-muted-foreground">Pré-visualize, aprove ou troque a imagem.</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] gap-1.5"
                    onClick={(e) => { e.stopPropagation(); setEditingImage(!editingImage); }}
                  >
                    {editingImage ? <><X className="h-3 w-3" />Fechar</> : <><Wand2 className="h-3 w-3" />Mudar imagem</>}
                  </Button>
                </div>
                <div className="bg-surface-800">
                  <img src={c.imageUrl} alt={`Arte da campanha ${c.title}`} className="w-full h-60 object-cover" />
                </div>
                <div className="flex items-center justify-between px-3 py-2 text-[11px] text-muted-foreground">
                  <span>Prévia renderizada</span>
                  <a href={c.imageUrl} target="_blank" rel="noreferrer" className="text-gold-400 hover:text-gold-300 underline" onClick={(e) => e.stopPropagation()}>
                    Abrir em nova aba
                  </a>
                </div>
              </>
            )}
            {openEditor && (
              <div className={`space-y-2 px-3 py-3 ${c.imageUrl ? "border-t border-border/40" : ""}`}>
                <div className="flex flex-wrap gap-2">
                  <input
                    id={`upload-${c.id}`}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onUploadImage(c.id, file);
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
                    {uploadingImage === c.id ? "Enviando..." : "Enviar foto"}
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 text-[11px] gap-1.5 border border-purple-500/40 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 shadow-none"
                    disabled={generatingImage === c.id}
                    onClick={(e) => { e.stopPropagation(); setShowGenerateModal(true); }}
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
            {showGenerateModal && (
              <GenerateImageModal
                generating={generatingImage === c.id}
                imageCreditCosts={imageCreditCosts}
                briefing={c.artBriefing}
                onGenerate={handleGenerateImage}
                onClose={() => setShowGenerateModal(false)}
              />
            )}
          </div>

          {!instagramConfigured && c.status === "APPROVED" && (
            <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2 flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-amber-400 font-medium">Instagram não conectado</p>
                <p className="text-[10px] text-amber-400/70 mt-0.5">Configure para publicar diretamente, ou copie o texto e salve a imagem para postar manualmente.</p>
              </div>
              <a href="/integrations" onClick={(e) => e.stopPropagation()} className="shrink-0 rounded p-1.5 hover:bg-amber-500/20 text-amber-400 transition-colors" title="Configurar integrações">
                <Settings className="h-4 w-4" />
              </a>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              size="sm" variant="ghost"
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
            <div className="flex gap-2 flex-wrap">
              {c.status === "DRAFT" && (
                <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={(e) => { e.stopPropagation(); onApprove(c.id); }}>
                  Aprovar
                </Button>
              )}
              {(c.status === "ARCHIVED" || c.status === "PUBLISHED") && onRepublish && (
                <Button
                  size="sm" variant="outline"
                  className="h-7 text-[11px] gap-1 border-purple-500/40 text-purple-400 hover:bg-purple-500/10"
                  onClick={(e) => { e.stopPropagation(); onRepublish(c.id); }}
                >
                  <Wand2 className="h-3 w-3" /> Republicar
                </Button>
              )}
              {c.status === "ARCHIVED" && onRestore && (
                <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={(e) => { e.stopPropagation(); onRestore(c.id); }}>
                  Restaurar
                </Button>
              )}
              {c.status !== "PUBLISHED" && c.status !== "ARCHIVED" && (
                <Button size="sm" variant="ghost" className="h-7 text-[11px] gap-1" onClick={(e) => { e.stopPropagation(); onRemove(c.id); }} disabled={deletingId === c.id}>
                  <Archive className="h-3 w-3" />
                  {deletingId === c.id ? "Arquivando..." : "Arquivar"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main client ───────────────────────────────────────────────

export function CampaignsClient({ campaigns: initial, instagramConfigured, hasBrandStyle = false, availableOffers = [], imageCreditCosts = { low: 40, medium: 70, high: 190 }, aiAllowance = { used: 0, limit: 300, creditsRemaining: 0 } }: {
  campaigns: CampaignDto[];
  instagramConfigured: boolean;
  hasBrandStyle?: boolean;
  availableOffers?: OfferOption[];
  imageCreditCosts?: { low: number; medium: number; high: number };
  aiAllowance?: { used: number; limit: number; creditsRemaining: number };
}) {
  const [campaigns, setCampaigns] = useState<CampaignDto[]>(initial);
  const [expandedPublished, setExpandedPublished] = useState<string | null>(null);

  const [theme, setTheme] = useState("");
  const [selectedOfferId, setSelectedOfferId] = useState<string>("");
  const [imageQuality, setImageQuality] = useState<ImageQualityTier>("medium");
  const [loadingThemes, setLoadingThemes] = useState(false);
  const [suggestedThemes, setSuggestedThemes] = useState<{ title: string; description: string }[]>([]);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [generatingImage, setGeneratingImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [archivedPage, setArchivedPage] = useState(1);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const ARCHIVED_PAGE_SIZE = 3;
  const [approveModal, setApproveModal]     = useState<string | null>(null); // campaignId
  const [rescheduleModal, setRescheduleModal] = useState<string | null>(null);
  const [schedulingId, setSchedulingId]     = useState<string | null>(null);
  // Queue inline text editing (for scheduled/approved campaigns list)
  const [editingText, setEditingText]       = useState<string | null>(null);
  const [editedText, setEditedText]         = useState<Record<string, string>>({});
  const [savingText, setSavingText]         = useState<string | null>(null);

  async function createCampaign() {
    if (!theme) return;

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
      errorMsg:           null,
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
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5 min

    try {
      const res = await fetch("/api/campaigns", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ theme: currentTheme, channel: "instagram", offerId: currentOfferId || undefined, imageQuality }),
        signal:  controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (isAiLimitError(res.status, data)) { triggerAiLimitModal(); setCampaigns((prev) => prev.filter((c) => c.id !== tempId)); return; }
      if (!res.ok) throw new Error(data.error ?? "Erro ao criar campanha");

      // Substitui placeholder pelo card real
      setCampaigns((prev) => prev.map((c) => c.id === tempId ? data.campaign : c));

      window.dispatchEvent(new Event("notifications-changed"));
      window.dispatchEvent(new Event("ai-used"));

      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "default") {
          const perm = await Notification.requestPermission();
          if (perm === "granted") {
            new Notification("Campanha pronta! ✨", { body: `"${data.campaign.title}" está aguardando sua aprovação.`, icon: "/favicon.ico" });
          }
        } else if (Notification.permission === "granted") {
          new Notification("Campanha pronta! ✨", { body: `"${data.campaign.title}" está aguardando sua aprovação.`, icon: "/favicon.ico" });
        }
      }
    } catch (e) {
      clearTimeout(timeoutId);
      const isTimeout = e instanceof DOMException && e.name === "AbortError";
      const errorMsg  = isTimeout
        ? "Tempo limite excedido. Verifique sua conexão e tente novamente."
        : String(e);

      // Substitui placeholder por FAILED (fica visível com botão de retry)
      setCampaigns((prev) => prev.map((c) =>
        c.id === tempId ? { ...c, status: "FAILED", errorMsg } : c,
      ));

      toast({ title: "Falha ao criar campanha", description: errorMsg, variant: "destructive" });
      // Atualiza sininho — page.tsx cleanup vai criar a notificação no próximo load
      window.dispatchEvent(new Event("notifications-changed"));
    }
  }

  async function fetchThemes() {
    setLoadingThemes(true);
    setSuggestedThemes([]);
    try {
      const res = await fetch("/api/campaigns/themes", { method: "POST" });
      const data = await res.json();
      if (isAiLimitError(res.status, data)) { triggerAiLimitModal(); return; }
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

  async function generateImage(id: string, promptOverride?: string, quality?: ImageQualityTier): Promise<void> {
    // Pre-flight check: verify credits cover the cost before calling the API
    const effectiveQuality = quality ?? imageQuality;
    const cost = imageCreditCosts[effectiveQuality];
    // Use Math.max(0, ...) so that over-usage of the base plan doesn't eat into purchased credits
    const baseRemaining = Math.max(0, aiAllowance.limit - aiAllowance.used);
    const available = baseRemaining + aiAllowance.creditsRemaining;
    if (available < cost) {
      const missing = cost - available;
      const err = new Error(
        `Créditos insuficientes. Esta qualidade custa ${cost} créditos, mas você tem ${available} disponíveis (faltam ${missing}).`
      );
      (err as any).code = "insufficient_credits";
      throw err;
    }

    setGeneratingImage(id);
    try {
      const res = await fetch(`/api/campaigns/${id}/image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptOverride: promptOverride || undefined, imageQuality: quality ?? imageQuality }),
      });
      const data = await res.json();
      if (isAiLimitError(res.status, data)) {
        triggerAiLimitModal();
        const err = new Error("Limite de créditos de IA atingido para este período.");
        (err as any).code = "ai_limit";
        throw err;
      }
      if (!res.ok) throw new Error(data.error ?? "Erro ao gerar imagem");
      window.dispatchEvent(new Event("ai-used"));
      window.dispatchEvent(new Event("notifications-changed"));
      setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, imageUrl: data.url } : c)));
      toast({ title: "Imagem gerada", description: "Arte criada via IA." });
    } catch (e) {
      throw e; // modal catches and shows inline
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

  async function saveText(id: string, text: string): Promise<void> {
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar texto");
      setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, text } : c)));
      toast({ title: "Texto salvo", description: "Copy da campanha atualizado." });
    } catch (e) {
      toast({ title: "Erro ao salvar texto", description: String(e), variant: "destructive" });
      throw e;
    }
  }

  async function saveQueueText(id: string) {
    const text = editedText[id];
    if (text === undefined) return;
    setSavingText(id);
    try {
      await saveText(id, text);
      setEditingText(null);
    } finally {
      setSavingText(null);
    }
  }

  async function remove(id: string) {
    // Placeholder local (falhou antes de persistir no DB) — só remove do estado
    if (id.startsWith("generating-")) {
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
      return;
    }
    setDeletingId(id);
    try {
      const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Erro", description: data.error ?? "Não foi possível deletar" , variant: "destructive"});
        return;
      }
      // UPDATE local state: set status to ARCHIVED instead of removing
      setCampaigns((prev) => prev.map((c) => c.id === id ? { ...c, status: "ARCHIVED" } : c));
      toast({ title: "Campanha arquivada", description: "Guardada no arquivo para uso futuro." });
    } catch (e) {
      toast({ title: "Erro", description: String(e), variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  }

  async function restore(id: string) {
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DRAFT" }),
      });
      if (!res.ok) { toast({ title: "Erro ao restaurar", variant: "destructive" }); return; }
      setCampaigns((prev) => prev.map((c) => c.id === id ? { ...c, status: "DRAFT" } : c));
      toast({ title: "Campanha restaurada", description: "Movida de volta para rascunhos." });
    } catch (e) {
      toast({ title: "Erro", description: String(e), variant: "destructive" });
    }
  }

  async function republish(id: string) {
    try {
      const res = await fetch(`/api/campaigns/${id}/republish`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast({ title: "Erro ao republicar", description: data.error, variant: "destructive" }); return; }
      setCampaigns((prev) => [data.campaign, ...prev]);
      toast({ title: "Nova campanha criada", description: "Adicionada aos rascunhos para aprovação." });
    } catch (e) {
      toast({ title: "Erro", description: String(e), variant: "destructive" });
    }
  }

  // ── Helpers ────────────────────────────────────────────────
  const generatingCampaigns = campaigns.filter((c) => c.status === "GENERATING");
  const queueCampaigns      = campaigns.filter((c) => ["SCHEDULED", "APPROVED", "FAILED"].includes(c.status));
  const draftCampaigns      = campaigns.filter((c) => c.status === "DRAFT");
  const dismissedCampaigns  = campaigns.filter((c) => c.status === "DISMISSED");
  const archivedCampaigns   = campaigns.filter((c) => c.status === "ARCHIVED");

  function isToday(dateStr: string | null) {
    if (!dateStr) return false;
    return new Date(dateStr).toDateString() === new Date().toDateString();
  }

  function formatScheduled(dateStr: string | null) {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
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
            href="/settings?section=identity"
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
                A IA escreve o texto e sugere o briefing da arte. Depois você escolhe: gerar a imagem com IA ou usar uma foto sua.
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
            <Button
              onClick={createCampaign}
              disabled={!theme}
              className="text-xs gap-2 font-semibold bg-purple-600 hover:bg-purple-500 text-white"
            >
              <Wand2 className="h-3.5 w-3.5" />
              Gerar texto da campanha
            </Button>
            {!instagramConfigured && (
              <p className="text-[11px] text-amber-400/80">Instagram não conectado — <a href="/settings?section=integrations" className="underline">configurar</a></p>
            )}
            <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
              <span>💡</span>
              1 crédito · a imagem pode ser gerada depois ou você pode usar uma foto própria
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
          <div className="flex gap-4 overflow-x-auto pb-1 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
            {generatingCampaigns.map((c) => <div key={c.id} className="shrink-0 w-80 snap-start"><GeneratingCard c={c} /></div>)}
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
          <div className="flex gap-4 overflow-x-auto pb-1 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
            {draftCampaigns.map((c) => (
              <div key={c.id} className="shrink-0 w-80 snap-start">
                <CampaignCard
                  c={c}
                  uploadingImage={uploadingImage} generatingImage={generatingImage} deletingId={deletingId}
                  hasBrandStyle={hasBrandStyle} instagramConfigured={instagramConfigured}
                  imageCreditCosts={imageCreditCosts}
                  onUploadImage={uploadImage} onGenerateImage={generateImage} onSaveText={saveText}
                  onRemove={remove} onRestore={restore} onRepublish={republish} onApprove={(id) => setApproveModal(id)}
                />
              </div>
            ))}
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
          <CardContent className="px-0 pb-3">
            <div className="flex gap-3 overflow-x-auto px-4 pb-1 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
              {queueCampaigns.map((c) => {
                const today   = isToday(c.scheduledAt);
                const dateStr = formatScheduled(c.scheduledAt);
                return (
                  <div key={c.id} className={`shrink-0 w-72 snap-start rounded-lg border border-border p-3 flex flex-col gap-2 ${today ? "bg-amber-500/5 border-amber-500/20" : "bg-surface-800/40"}`}>
                    {/* Title + badges */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-semibold text-foreground truncate">{c.title}</p>
                        {today && c.scheduledAt && (
                          <LaunchCountdown scheduledAt={c.scheduledAt} />
                        )}
                        {!c.imageUrl && (
                          <span className="text-[10px] text-red-400/80 shrink-0">sem imagem</span>
                        )}
                      </div>
                      {c.status === "FAILED" && c.errorMsg ? (
                        <p className="text-[11px] text-red-400/80 mt-0.5">{c.errorMsg}</p>
                      ) : dateStr ? (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{dateStr}</p>
                      ) : (
                        <p className="text-[11px] text-amber-400/70 mt-0.5">Sem data definida</p>
                      )}
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1.5">
                      {c.status === "FAILED" ? (
                        c.id.startsWith("generating-") ? (
                          <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={(e) => { e.stopPropagation(); remove(c.id); }}>
                            Descartar
                          </Button>
                        ) :!instagramConfigured ? (
                          <Link href="/settings?section=integrations#integrations" onClick={(e) => e.stopPropagation()}>
                            <Button size="sm" className="h-7 text-[11px] gap-1 border-amber-500/40 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20" variant="outline">
                              <Settings className="h-3 w-3" />Conectar Instagram
                            </Button>
                          </Link>
                        ) : (
                          <Button
                            size="sm"
                            className="h-7 text-[11px] gap-1"
                            onClick={(e) => { e.stopPropagation(); setStatus(c.id, "SCHEDULED"); }}
                          >
                            <Send className="h-3 w-3" />Tentar novamente
                          </Button>
                        )
                      ) :!instagramConfigured ? (
                        <Link href="/settings?section=integrations#integrations" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" className="h-7 text-[11px] gap-1 border-amber-500/40 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20" variant="outline">
                            <Settings className="h-3 w-3" />Conectar Instagram
                          </Button>
                        </Link>
                      ) : (
                        <Button
                          size="sm"
                          className="h-7 text-[11px] gap-1"
                          onClick={(e) => { e.stopPropagation(); publish(c.id); }}
                          disabled={publishingId === c.id || !c.imageUrl}
                          title={!c.imageUrl ? "Adicione uma imagem primeiro" : undefined}
                        >
                          {publishingId === c.id ? <><Sparkles className="h-3 w-3 animate-spin" />Publicando...</> : <><Send className="h-3 w-3" />Enviar agora</>}
                        </Button>
                      )}
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
                    {editingText === c.id && (
                      <div className="mt-1 space-y-2" onClick={(e) => e.stopPropagation()}>
                        <textarea
                          value={editedText[c.id] ?? c.text}
                          onChange={(e) => setEditedText((prev) => ({ ...prev, [c.id]: e.target.value }))}
                          rows={4}
                          className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-xs text-foreground leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setEditingText(null)} disabled={savingText === c.id}>Cancelar</Button>
                          <Button size="sm" className="h-7 text-[11px]" onClick={() => saveQueueText(c.id)} disabled={savingText === c.id}>
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
          <div className="flex gap-4 overflow-x-auto pb-1 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
            {dismissedCampaigns.map((c) => (
              <div key={c.id} className="shrink-0 w-80 snap-start">
                <CampaignCard
                  c={c}
                  uploadingImage={uploadingImage} generatingImage={generatingImage} deletingId={deletingId}
                  hasBrandStyle={hasBrandStyle} instagramConfigured={instagramConfigured}
                  imageCreditCosts={imageCreditCosts}
                  onUploadImage={uploadImage} onGenerateImage={generateImage} onSaveText={saveText}
                  onRemove={remove} onRestore={restore} onRepublish={republish} onApprove={(id) => setApproveModal(id)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Campanhas arquivadas ───────────────────────────── */}
      {archivedCampaigns.length > 0 && (
        <div className="space-y-3">
          <button
            className="flex items-center gap-2 px-0.5 w-full text-left"
            onClick={() => { setArchivedOpen((v) => !v); setArchivedPage(1); }}
          >
            <Archive className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold text-muted-foreground">Arquivadas</p>
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">{archivedCampaigns.length}</span>
            {archivedOpen
              ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
              : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-auto" />}
          </button>

          {archivedOpen && (() => {
            const totalPages = Math.ceil(archivedCampaigns.length / ARCHIVED_PAGE_SIZE);
            const paginated  = archivedCampaigns.slice((archivedPage - 1) * ARCHIVED_PAGE_SIZE, archivedPage * ARCHIVED_PAGE_SIZE);
            return (
              <div className="space-y-3">
                <div className="flex gap-4 overflow-x-auto pb-1 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                  {paginated.map((c) => (
                    <div key={c.id} className="shrink-0 w-80 snap-start">
                      <CampaignCard
                        c={c}
                        uploadingImage={uploadingImage} generatingImage={generatingImage} deletingId={deletingId}
                        hasBrandStyle={hasBrandStyle} instagramConfigured={instagramConfigured}
                        imageCreditCosts={imageCreditCosts}
                        onUploadImage={uploadImage} onGenerateImage={generateImage} onSaveText={saveText}
                        onRemove={remove} onRestore={restore} onRepublish={republish} onApprove={(id) => setApproveModal(id)}
                      />
                    </div>
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      size="sm" variant="outline" className="h-7 text-[11px]"
                      disabled={archivedPage === 1}
                      onClick={() => setArchivedPage((p) => p - 1)}
                    >
                      Anterior
                    </Button>
                    <span className="text-[11px] text-muted-foreground">{archivedPage} / {totalPages}</span>
                    <Button
                      size="sm" variant="outline" className="h-7 text-[11px]"
                      disabled={archivedPage === totalPages}
                      onClick={() => setArchivedPage((p) => p + 1)}
                    >
                      Próxima
                    </Button>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
