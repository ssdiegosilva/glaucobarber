"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload, Sparkles, CheckCircle2, Clock, Send, Trash2, Instagram,
  AlertCircle, GalleryHorizontal, ExternalLink, Calendar, X, ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────

interface VitrineFotoDto {
  id: string;
  vitrinPostId: string;
  path: string;
  position: number;
  createdAt: string;
}

interface VitrinPostDto {
  id: string;
  status: string;
  caption: string;
  instagramPostId: string | null;
  instagramPermalink: string | null;
  errorMsg: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  images: VitrineFotoDto[];
}

interface Props {
  initialPosts: VitrinPostDto[];
  instagramConfigured: boolean;
  instagramUsername: string | null;
  aiAllowed: boolean;
}

// ── Status helpers ───────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  DRAFT:     "Rascunho",
  APPROVED:  "Aprovado",
  SCHEDULED: "Agendado",
  PUBLISHED: "Publicado",
  FAILED:    "Falhou",
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT:     "bg-zinc-700 text-zinc-300",
  APPROVED:  "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
  SCHEDULED: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
  PUBLISHED: "bg-gold-500/20 text-gold-400 border border-gold-500/30",
  FAILED:    "bg-red-500/20 text-red-400 border border-red-500/30",
};

// ── Schedule Modal ───────────────────────────────────────────

function ScheduleModal({
  postId,
  onConfirm,
  onClose,
}: {
  postId: string;
  onConfirm: (id: string, scheduledAt: string) => void;
  onClose: () => void;
}) {
  const [dt, setDt] = useState("");

  const minDate = new Date();
  minDate.setMinutes(minDate.getMinutes() + 5);
  const minStr = minDate.toISOString().slice(0, 16);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Agendar publicação</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <input
          type="datetime-local"
          min={minStr}
          value={dt}
          onChange={(e) => setDt(e.target.value)}
          className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-foreground"
        />
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button
            size="sm"
            className="bg-gold-500 hover:bg-gold-400 text-black"
            disabled={!dt}
            onClick={() => dt && onConfirm(postId, new Date(dt).toISOString())}
          >
            Agendar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Post Card ────────────────────────────────────────────────

function PostCard({
  post,
  onApprove,
  onSchedule,
  onPublish,
  onDelete,
  onGenerateCaption,
  onSaveCaption,
  instagramConfigured,
  aiAllowed,
  generatingCaption,
  publishing,
}: {
  post: VitrinPostDto;
  onApprove: (id: string) => void;
  onSchedule: (id: string) => void;
  onPublish: (id: string) => void;
  onDelete: (id: string) => void;
  onGenerateCaption: (id: string) => void;
  onSaveCaption: (id: string, caption: string) => void;
  instagramConfigured: boolean;
  aiAllowed: boolean;
  generatingCaption: boolean;
  publishing: boolean;
}) {
  const [editingCaption, setEditingCaption] = useState(post.caption);
  const [captionDirty, setCaptionDirty] = useState(false);

  // Sync when AI generates a new caption
  useEffect(() => {
    if (post.caption && !captionDirty) {
      setEditingCaption(post.caption);
    }
  }, [post.caption, captionDirty]);
  const isPublished = post.status === "PUBLISHED";
  const canAct      = ["DRAFT", "APPROVED", "SCHEDULED"].includes(post.status);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
      {/* Photo grid — hidden for published posts with no images (deleted after upload) */}
      {post.images.length > 0 && (
        <div className={cn(
          "grid gap-0.5 bg-zinc-800",
          post.images.length === 1 ? "grid-cols-1" :
          post.images.length === 2 ? "grid-cols-2" : "grid-cols-3"
        )}>
          {post.images.map((img) => (
            <div key={img.id} className="aspect-square bg-zinc-800 relative overflow-hidden">
              <img
                src={`/api/vitrine/photo?path=${encodeURIComponent(img.path)}`}
                alt={`Foto ${img.position + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full", STATUS_COLOR[post.status])}>
            {STATUS_LABEL[post.status] ?? post.status}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {new Date(post.createdAt).toLocaleDateString("pt-BR")}
          </span>
        </div>

        {/* Caption */}
        {isPublished ? (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">{post.caption || "Sem legenda"}</p>
        ) : (
          <div className="space-y-2">
            <textarea
              value={editingCaption}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => { setEditingCaption(e.target.value); setCaptionDirty(true); }}
              placeholder="Legenda do post..."
              rows={3}
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
            {captionDirty && (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-7"
                  onClick={() => { onSaveCaption(post.id, editingCaption); setCaptionDirty(false); }}
                >
                  Salvar legenda
                </Button>
              </div>
            )}
            {!post.caption && (
              <Button
                size="sm"
                disabled={!aiAllowed || generatingCaption}
                onClick={() => onGenerateCaption(post.id)}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white text-xs"
              >
                {generatingCaption ? (
                  <>
                    <div className="h-3 w-3 mr-1.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Gerando legenda...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3 mr-1.5" />
                    Gerar legenda com IA {!aiAllowed && "(sem créditos)"}
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {/* Instagram link */}
        {isPublished && post.instagramPermalink && (
          <a
            href={post.instagramPermalink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-gold-400 hover:text-gold-300"
          >
            <Instagram className="h-3 w-3" />
            Ver no Instagram
            <ExternalLink className="h-3 w-3" />
          </a>
        )}

        {/* Error */}
        {post.status === "FAILED" && post.errorMsg && (
          <p className="text-xs text-red-400 flex items-start gap-1.5">
            <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
            {post.errorMsg}
          </p>
        )}

        {/* Scheduled at */}
        {post.status === "SCHEDULED" && post.scheduledAt && (
          <p className="text-xs text-blue-400 flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            {new Date(post.scheduledAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
          </p>
        )}

        {/* Actions */}
        {canAct && (
          <div className="flex flex-wrap gap-2 pt-1">
            {post.status === "DRAFT" && (
              <Button
                size="sm"
                className="bg-gold-500 hover:bg-gold-400 text-black text-xs h-8"
                onClick={() => onApprove(post.id)}
                disabled={!post.caption?.trim()}
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Aprovar
              </Button>
            )}
            {post.status === "APPROVED" && (
              <>
                <Button
                  size="sm"
                  className="bg-gold-500 hover:bg-gold-400 text-black text-xs h-8"
                  onClick={() => onPublish(post.id)}
                  disabled={!instagramConfigured || publishing}
                  title={!instagramConfigured ? "Configure o Instagram em Configurações > Integrações" : undefined}
                >
                  {publishing ? (
                    <>
                      <div className="h-3 w-3 mr-1 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      Publicando...
                    </>
                  ) : (
                    <>
                      <Send className="h-3 w-3 mr-1" />
                      Publicar agora
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-8"
                  onClick={() => onSchedule(post.id)}
                  disabled={publishing}
                >
                  <Calendar className="h-3 w-3 mr-1" />
                  Agendar
                </Button>
              </>
            )}
            {post.status === "SCHEDULED" && (
              <Button
                size="sm"
                className="bg-gold-500 hover:bg-gold-400 text-black text-xs h-8"
                onClick={() => onPublish(post.id)}
                disabled={!instagramConfigured || publishing}
              >
                {publishing ? (
                  <>
                    <div className="h-3 w-3 mr-1 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    Publicando...
                  </>
                ) : (
                  <>
                    <Send className="h-3 w-3 mr-1" />
                    Publicar agora
                  </>
                )}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-8 text-red-400 hover:text-red-300 hover:bg-red-500/10 ml-auto"
              onClick={() => onDelete(post.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Upload Area ──────────────────────────────────────────────

function UploadArea({ onUpload, uploading }: { onUpload: (files: File[]) => void; uploading: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).slice(0, 3);
    setPreviews(arr.map((f) => URL.createObjectURL(f)));
    onUpload(arr);
    setTimeout(() => setPreviews([]), 3000);
  }, [onUpload]);

  return (
    <div
      className={cn(
        "border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer",
        dragging ? "border-purple-500 bg-purple-500/5" : "border-zinc-700 hover:border-zinc-600",
        uploading && "opacity-60 pointer-events-none",
      )}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {previews.length > 0 ? (
        <div className="flex gap-2 justify-center">
          {previews.map((src, i) => (
            <img key={i} src={src} className="h-16 w-16 object-cover rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20">
            {uploading ? (
              <div className="h-5 w-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Upload className="h-5 w-5 text-purple-400" />
            )}
          </div>
          <p className="text-sm font-medium text-foreground mb-1">
            {uploading ? "Enviando fotos..." : "Enviar fotos do trabalho"}
          </p>
          <p className="text-xs text-muted-foreground">
            Arraste ou clique · até 3 fotos · carrossel no Instagram
          </p>
        </>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────

export function VitrineClient({ initialPosts, instagramConfigured, instagramUsername, aiAllowed }: Props) {
  const [posts, setPosts]         = useState<VitrinPostDto[]>(initialPosts);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading]     = useState<Record<string, boolean>>({});
  const [captioningId, setCaptioningId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [schedulePostId, setSchedulePostId] = useState<string | null>(null);
  const [toast, setToast]         = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const setPostLoading = (id: string, val: boolean) =>
    setLoading((prev) => ({ ...prev, [id]: val }));

  // ── Upload ─────────────────────────────────────────────────

  async function handleUpload(files: File[]) {
    setUploading(true);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("images", f));
      const res = await fetch("/api/vitrine", { method: "POST", body: fd });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      const { post } = await res.json();
      setPosts((prev) => [post, ...prev]);
      showToast("Fotos enviadas! Adicione uma legenda e aprove para publicar.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao enviar fotos", "error");
    } finally {
      setUploading(false);
    }
  }

  // ── Generate caption ───────────────────────────────────────

  async function handleGenerateCaption(id: string) {
    setCaptioningId(id);
    try {
      const res = await fetch(`/api/vitrine/${id}/caption`, { method: "POST" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message ?? e.error); }
      const { caption } = await res.json();
      setPosts((prev) => prev.map((p) => p.id === id ? { ...p, caption } : p));
      showToast("Legenda gerada!");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao gerar legenda", "error");
    } finally {
      setCaptioningId(null);
    }
  }

  // ── Save caption ───────────────────────────────────────────

  async function handleSaveCaption(id: string, caption: string) {
    try {
      const res = await fetch(`/api/vitrine/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption }),
      });
      if (!res.ok) throw new Error();
      setPosts((prev) => prev.map((p) => p.id === id ? { ...p, caption } : p));
    } catch {
      showToast("Erro ao salvar legenda", "error");
    }
  }

  // ── Status update ──────────────────────────────────────────

  async function updateStatus(id: string, status: string, extra?: { scheduledAt?: string }) {
    setPostLoading(id, true);
    try {
      const res = await fetch(`/api/vitrine/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...extra }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      const { post } = await res.json();
      setPosts((prev) => prev.map((p) => p.id === id ? post : p));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro", "error");
    } finally {
      setPostLoading(id, false);
    }
  }

  // ── Publish ────────────────────────────────────────────────

  async function handlePublish(id: string) {
    setPublishingId(id);
    try {
      const res = await fetch(`/api/vitrine/${id}/publish`, { method: "POST" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      const { permalink } = await res.json();
      setPosts((prev) => prev.map((p) => p.id === id
        ? { ...p, status: "PUBLISHED", instagramPermalink: permalink, images: [] }
        : p
      ));
      showToast("Publicado no Instagram!");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao publicar", "error");
    } finally {
      setPublishingId(null);
    }
  }

  // ── Delete ─────────────────────────────────────────────────

  async function handleDelete(id: string) {
    setPostLoading(id, true);
    try {
      const res = await fetch(`/api/vitrine/${id}`, { method: "DELETE" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      setPosts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao apagar", "error");
    } finally {
      setPostLoading(id, false);
    }
  }

  // ── Schedule confirm ───────────────────────────────────────

  async function handleScheduleConfirm(id: string, scheduledAt: string) {
    setSchedulePostId(null);
    await updateStatus(id, "SCHEDULED", { scheduledAt });
    showToast("Post agendado!");
  }

  // ── Render ─────────────────────────────────────────────────

  const draftPosts     = posts.filter((p) => p.status === "DRAFT");
  const approvedPosts  = posts.filter((p) => p.status === "APPROVED");
  const scheduledPosts = posts.filter((p) => p.status === "SCHEDULED");
  const publishedPosts = posts.filter((p) => p.status === "PUBLISHED");
  const failedPosts    = posts.filter((p) => p.status === "FAILED");

  return (
    <div className="flex flex-col flex-1 overflow-auto p-4 sm:p-6 space-y-6 max-w-4xl">

      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed top-4 right-4 z-50 rounded-lg px-4 py-3 text-sm shadow-xl border",
          toast.type === "success"
            ? "bg-zinc-900 border-emerald-500/30 text-emerald-400"
            : "bg-zinc-900 border-red-500/30 text-red-400",
        )}>
          {toast.msg}
        </div>
      )}

      {/* Instagram warning */}
      {!instagramConfigured && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-300">
            Instagram não configurado.{" "}
            <a href="/settings?section=integrations" className="underline hover:text-amber-200">
              Configure em Integrações
            </a>{" "}
            para poder publicar.
          </p>
        </div>
      )}

      {/* Upload area */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <GalleryHorizontal className="h-4 w-4 text-purple-400" />
          <h2 className="text-sm font-semibold text-foreground">Novo post</h2>
          <span className="text-xs text-muted-foreground">até 3 fotos por carrossel</span>
        </div>
        <UploadArea onUpload={handleUpload} uploading={uploading} />
      </div>

      {/* Posts by status */}
      {[
        { label: "Rascunhos", posts: draftPosts },
        { label: "Aprovados", posts: approvedPosts },
        { label: "Agendados", posts: scheduledPosts },
        { label: "Publicados", posts: publishedPosts },
        { label: "Com erro", posts: failedPosts },
      ].filter(({ posts }) => posts.length > 0).map(({ label, posts: group }) => (
        <div key={label}>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">
            {label} <span className="text-zinc-500">({group.length})</span>
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.map((post) => (
              <div key={post.id} className={cn(loading[post.id] && !captioningId && "opacity-60 pointer-events-none")}>
                <PostCard
                  post={post}
                  onApprove={(id) => updateStatus(id, "APPROVED")}
                  onSchedule={(id) => setSchedulePostId(id)}
                  onPublish={handlePublish}
                  onDelete={handleDelete}
                  onGenerateCaption={handleGenerateCaption}
                  onSaveCaption={handleSaveCaption}
                  instagramConfigured={instagramConfigured}
                  aiAllowed={aiAllowed}
                  generatingCaption={captioningId === post.id}
                  publishing={publishingId === post.id}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      {posts.length === 0 && !uploading && (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <GalleryHorizontal className="h-10 w-10 mb-3 text-zinc-700" />
          <p className="text-sm">Nenhum post ainda. Envie suas primeiras fotos acima!</p>
        </div>
      )}

      {/* Schedule modal */}
      {schedulePostId && (
        <ScheduleModal
          postId={schedulePostId}
          onConfirm={handleScheduleConfirm}
          onClose={() => setSchedulePostId(null)}
        />
      )}
    </div>
  );
}
