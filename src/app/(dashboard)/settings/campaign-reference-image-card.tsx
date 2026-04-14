"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Camera, RefreshCw, Trash2, Upload } from "lucide-react";

interface CampaignReferenceImageCardProps {
  initialUrl: string | null;
  tenantLabel?: string;
}

export function CampaignReferenceImageCard({ initialUrl, tenantLabel = "estabelecimento" }: CampaignReferenceImageCardProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [currentUrl, setCurrentUrl] = useState(initialUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  function triggerFile() {
    inputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/uploads/reference-image", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao enviar imagem");

      await saveReferenceUrl(data.url);
      toast({ title: "Foto salva!", description: "Usaremos esta foto como base nas campanhas." });
    } catch (err) {
      toast({ title: "Erro ao enviar", description: String(err), variant: "destructive" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function saveReferenceUrl(url: string | null) {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/campaign-reference-image", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar");
      setCurrentUrl(data.barbershop.campaignReferenceImageUrl ?? "");
    } catch (err) {
      toast({ title: "Erro ao salvar", description: String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!currentUrl) return;
    await saveReferenceUrl(null);
    toast({ title: "Foto removida", description: "Voltaremos a gerar sem base fotográfica." });
  }

  return (
    <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-surface-900 via-surface-900 to-blue-950/15 overflow-hidden shadow-lg">
      <div className="h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-sky-300" />
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
              <Camera className="h-4 w-4 text-blue-300" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Foto base das campanhas</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Usada como referência visual ao gerar a arte com IA
              </p>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Envie uma foto do {tenantLabel} ou do estilo desejado. A IA vai usar essa imagem como base junto com o estilo visual configurado.
        </p>

        <div className="rounded-xl border border-border/60 bg-surface-800 p-3 flex items-center gap-3">
          <div className="relative h-24 w-24 overflow-hidden rounded-lg border border-border/50 bg-surface-700 flex items-center justify-center text-[11px] text-muted-foreground">
            {currentUrl ? (
              <Image src={currentUrl} alt="Foto base" fill className="object-cover" />
            ) : (
              "Sem foto"
            )}
          </div>

          <div className="flex-1 flex flex-wrap items-center gap-2">
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={triggerFile} disabled={uploading || saving}>
              {uploading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              {uploading ? "Enviando..." : "Enviar foto"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs gap-1.5 text-red-400"
              onClick={handleRemove}
              disabled={!currentUrl || saving || uploading}
            >
              <Trash2 className="h-3 w-3" /> Remover
            </Button>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
