"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { ExternalLink, RefreshCw, Save, Star } from "lucide-react";

interface GoogleReviewCardProps {
  initialUrl: string | null;
}

export function GoogleReviewCard({ initialUrl }: GoogleReviewCardProps) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [saving, setSaving] = useState(false);

  async function onSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/barbershop", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ googleReviewUrl: url || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Erro ao salvar", description: data.error ?? "Tente novamente.", variant: "destructive" });
        return;
      }
      setUrl(data.barbershop.googleReviewUrl ?? "");
      toast({ title: "Link atualizado", description: "URL de avaliação Google salva." });
    } catch (e) {
      toast({ title: "Erro ao salvar", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-blue-500/25 bg-blue-500/5 overflow-hidden shadow-sm">
      <div className="h-0.5 bg-gradient-to-r from-blue-600/60 via-blue-400/60 to-blue-600/60" />
      <div className="p-5 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-sm text-[16px] font-bold leading-none select-none"
            style={{ fontFamily: "sans-serif" }}
          >
            <span style={{ color: "#4285F4" }}>G</span>
          </span>
          <div>
            <p className="text-sm font-semibold text-blue-300 flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5" />
              Link de Avaliação Google
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Enviado automaticamente nas mensagens de pós-venda para seus clientes avaliarem no Google.
            </p>
          </div>
        </div>

        {/* Input */}
        <div className="space-y-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://g.page/r/..."
            className="w-full rounded-md border border-blue-500/30 bg-surface-800 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
            >
              <ExternalLink className="h-3 w-3" /> Testar link
            </a>
          )}
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <Button
            size="sm"
            className="text-xs gap-1 bg-gold-500 hover:bg-gold-400 text-black"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
