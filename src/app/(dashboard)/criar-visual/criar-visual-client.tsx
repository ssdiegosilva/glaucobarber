"use client";

import { useState, useRef, useCallback } from "react";
import { isAiLimitError, triggerAiLimitModal } from "@/lib/ai-error";
import Image from "next/image";
import { Upload, Wand2, Download, RefreshCw, X, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ImageQualityTier = "low" | "medium" | "high";

const QUALITY_META: Record<ImageQualityTier, { label: string; desc: string; color: string }> = {
  low:    { label: "Rascunho",       desc: "mais rápido",    color: "text-green-400" },
  medium: { label: "Padrão",         desc: "recomendado",    color: "text-amber-400" },
  high:   { label: "Alta qualidade", desc: "mais detalhado", color: "text-red-400"   },
};

interface HaircutSuggestion {
  faceShape: string;
  suggestedStyle: string;
  explanation: string;
  imagePrompt: string;
}

interface Result {
  suggestion: HaircutSuggestion;
  imageUrl: string;
}

const LOADING_MESSAGES = [
  "Analisando o formato do rosto...",
  "Consultando especialista virtual...",
  "Definindo o melhor estilo...",
  "Gerando o visual sugerido...",
  "Finalizando os detalhes...",
];

export default function CriarVisualClient({ creditCosts = { low: 40, medium: 70, high: 190 } }: {
  creditCosts?: { low: number; medium: number; high: number };
}) {
  const { toast } = useToast();

  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [result, setResult] = useState<Result | null>(null);
  const [dragging, setDragging] = useState(false);
  const [imageQuality, setImageQuality] = useState<ImageQualityTier>("medium");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleFile = useCallback((file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Foto muito grande", description: "Máximo 10MB.", variant: "destructive" });
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast({ title: "Formato inválido", description: "Use JPEG, PNG ou WebP.", variant: "destructive" });
      return;
    }
    setPhoto(file);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => setPhotoPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const clearPhoto = () => {
    setPhoto(null);
    setPhotoPreview(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startLoadingCycle = () => {
    let idx = 0;
    setLoadingMsg(LOADING_MESSAGES[0]);
    loadingIntervalRef.current = setInterval(() => {
      idx = (idx + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[idx]);
    }, 3000);
  };

  const stopLoadingCycle = () => {
    if (loadingIntervalRef.current) {
      clearInterval(loadingIntervalRef.current);
      loadingIntervalRef.current = null;
    }
  };

  const analyze = async () => {
    if (!photo) return;

    setLoading(true);
    setResult(null);
    startLoadingCycle();

    try {
      const formData = new FormData();
      formData.append("photo", photo);
      formData.append("imageQuality", imageQuality);

      const res = await fetch("/api/criar-visual", { method: "POST", body: formData });
      const data = await res.json();

      if (isAiLimitError(res.status, data)) { triggerAiLimitModal(); return; }
      if (!res.ok) {
        toast({ title: "Erro", description: data.error ?? "Tente novamente.", variant: "destructive" });
        return;
      }

      setResult(data);
    } catch {
      toast({ title: "Erro de conexão", description: "Tente novamente.", variant: "destructive" });
    } finally {
      stopLoadingCycle();
      setLoading(false);
    }
  };

  const downloadImage = async () => {
    if (!result) return;
    try {
      const res = await fetch(result.imageUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `visual-sugerido-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Erro ao baixar", description: "Tente novamente.", variant: "destructive" });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Upload area */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">Foto do Cliente</h2>

          {!photoPreview ? (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-12 cursor-pointer transition-all
                ${dragging ? "border-gold-400 bg-gold-500/10" : "border-border hover:border-gold-500/50 hover:bg-surface-700"}`}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold-500/15 border border-gold-500/30">
                <Upload className="h-6 w-6 text-gold-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">Arraste a foto aqui ou clique para selecionar</p>
                <p className="text-xs text-muted-foreground mt-1">JPEG, PNG ou WebP · Máximo 10MB</p>
                <p className="text-xs text-muted-foreground">Dica: use uma foto do rosto bem iluminada, de frente ou 3/4</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <div className="relative shrink-0 self-center sm:self-start">
                <Image
                  src={photoPreview}
                  alt="Foto do cliente"
                  width={200}
                  height={200}
                  className="rounded-xl object-cover w-32 h-32 sm:w-48 sm:h-48 border border-border"
                />
                <button
                  onClick={clearPhoto}
                  className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-surface-900 border border-border text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>

              <div className="flex flex-col gap-3 w-full sm:w-auto sm:justify-center sm:pt-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-foreground font-medium truncate">{photo?.name}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {photo ? (photo.size / 1024).toFixed(0) + " KB" : ""}
                </p>

                {/* Quality selector */}
                <div className="space-y-1.5 w-full">
                  <p className="text-[11px] font-medium text-muted-foreground">Qualidade da imagem</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(["low", "medium", "high"] as const).map((tier) => {
                      const m = QUALITY_META[tier];
                      const active = imageQuality === tier;
                      return (
                        <button
                          key={tier}
                          type="button"
                          onClick={() => setImageQuality(tier)}
                          className={`rounded-lg border px-2 py-1.5 text-center transition-colors ${
                            active
                              ? "border-purple-500/60 bg-purple-500/10"
                              : "border-border bg-surface-900/50 hover:bg-surface-800"
                          }`}
                        >
                          <p className={`text-[10px] font-semibold ${active ? "text-purple-300" : m.color}`}>{m.label}</p>
                          <p className={`text-[11px] font-bold tabular-nums ${active ? "text-purple-300" : "text-foreground"}`}>{creditCosts[tier]} cred.</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={analyze}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 rounded-lg bg-purple-600 hover:bg-purple-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full sm:w-auto"
                >
                  <Wand2 className="h-4 w-4" />
                  {loading ? "Analisando..." : `Analisar e Sugerir Corte (${creditCosts[imageQuality]} cred.)`}
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-700 transition-colors w-full sm:w-auto"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Trocar foto
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Loading state */}
        {loading && (
          <div className="bg-card border border-border rounded-xl p-8 flex flex-col items-center gap-4">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-gold-500/20" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-gold-400 animate-spin" />
              <Wand2 className="h-6 w-6 text-gold-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">{loadingMsg}</p>
              <p className="text-xs text-muted-foreground mt-1">Isso pode levar até 30 segundos</p>
            </div>
          </div>
        )}

        {/* Result */}
        {result && !loading && (
          <div className="space-y-4">
            {/* Analysis card */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold-500/15 border border-gold-500/30">
                  <Wand2 className="h-5 w-5 text-gold-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-2">
                    <h3 className="text-base font-semibold text-foreground">{result.suggestion.suggestedStyle}</h3>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gold-500/15 text-gold-400 border border-gold-500/20">
                      Rosto {result.suggestion.faceShape}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{result.suggestion.explanation}</p>
                </div>
              </div>
            </div>

            {/* Images side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Foto original</p>
                </div>
                {photoPreview && (
                  <Image
                    src={photoPreview}
                    alt="Foto original"
                    width={500}
                    height={500}
                    className="w-full aspect-square object-cover"
                  />
                )}
              </div>

              <div className="bg-card border border-gold-500/30 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gold-500/20 bg-gold-500/5">
                  <p className="text-xs font-medium text-gold-400 uppercase tracking-wide">Visual sugerido pela IA</p>
                </div>
                <Image
                  src={result.imageUrl}
                  alt="Visual sugerido"
                  width={500}
                  height={500}
                  className="w-full aspect-square object-cover"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={downloadImage}
                className="flex items-center justify-center gap-2 rounded-lg bg-purple-600 hover:bg-purple-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
              >
                <Download className="h-4 w-4" />
                Baixar imagem
              </button>
              <button
                onClick={analyze}
                disabled={loading}
                className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-700 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Gerar novamente
              </button>
              <button
                onClick={clearPhoto}
                className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-700 transition-colors"
              >
                <Upload className="h-4 w-4" />
                Nova foto
              </button>
            </div>
          </div>
        )}

        {/* Empty state hint */}
        {!photoPreview && !loading && !result && (
          <div className="text-center py-6 text-xs text-muted-foreground space-y-1">
            <p>A IA analisa o formato do rosto e sugere o corte mais adequado.</p>
            <p>Em seguida, gera uma foto mostrando como ficaria o resultado.</p>
            <p className="font-medium text-gold-400/70">Consome 2 créditos de IA por análise.</p>
          </div>
        )}
      </div>
    </div>
  );
}
