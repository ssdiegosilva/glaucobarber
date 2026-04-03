"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Sparkles, RefreshCw, Save, Palette, CheckCircle2 } from "lucide-react";

export function BrandStyleCard({ initialStyle }: { initialStyle: string | null }) {
  const [value, setValue]       = useState(initialStyle ?? "");
  const [saved, setSaved]       = useState(initialStyle ?? "");
  const [saving, setSaving]     = useState(false);
  const [improving, setImproving] = useState(false);

  const isDirty = value !== saved;

  async function handleImprove() {
    if (!value.trim()) {
      toast({ title: "Escreva algo primeiro", description: "Descreva brevemente o estilo visual da sua marca.", variant: "destructive" });
      return;
    }
    setImproving(true);
    try {
      const res  = await fetch("/api/settings/brand-style/improve", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ rawStyle: value.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Erro", description: data.message ?? "Não foi possível melhorar a descrição.", variant: "destructive" });
        return;
      }
      setValue(data.brandStyle);
      toast({ title: "Estilo aprimorado!", description: "A IA expandiu sua descrição visual." });
    } catch {
      toast({ title: "Erro de conexão", variant: "destructive" });
    } finally {
      setImproving(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res  = await fetch("/api/settings/brand-style", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ brandStyle: value.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Erro ao salvar", description: data.error ?? "Tente novamente.", variant: "destructive" });
        return;
      }
      setSaved(data.barbershop.brandStyle ?? "");
      setValue(data.barbershop.brandStyle ?? "");
      toast({ title: "Estilo salvo!", description: "Suas campanhas vão usar esse estilo nas imagens." });
    } catch {
      toast({ title: "Erro de conexão", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-surface-900 via-surface-900 to-purple-950/20 overflow-hidden shadow-lg">
      {/* Accent bar */}
      <div className="h-1 bg-gradient-to-r from-purple-600 via-purple-400 to-gold-500" />

      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center shrink-0">
              <Palette className="h-4 w-4 text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Identidade visual da marca</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Usada na geração de imagens de campanhas com IA
              </p>
            </div>
          </div>

          {saved && (
            <div className="flex items-center gap-1 text-[10px] text-emerald-400 shrink-0">
              <CheckCircle2 className="h-3 w-3" /> Configurado
            </div>
          )}
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground leading-relaxed">
          Descreva o estilo visual da sua barbearia em palavras simples. A IA vai usar isso para gerar imagens de campanha no seu estilo.
          Você pode escrever algo curto e usar o botão <span className="text-purple-400 font-medium">Melhorar com IA</span> para expandir automaticamente.
        </p>

        {/* Textarea */}
        <div className="space-y-1.5">
          <textarea
            className="w-full rounded-xl border border-border bg-surface-800 px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/40 resize-none"
            value={value}
            onChange={(e) => setValue(e.target.value.slice(0, 300))}
            rows={3}
            maxLength={300}
            placeholder="ex: fundo preto, detalhes dourados, premium masculino, cinematográfico, navalha dourada como símbolo central..."
          />
          <p className="text-[10px] text-muted-foreground/50 text-right">{value.length}/300</p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
            onClick={handleImprove}
            disabled={improving || saving}
          >
            {improving ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {improving ? "Aprimorando..." : "Melhorar com IA"}
          </Button>

          <Button
            size="sm"
            className="h-8 text-xs gap-1.5 ml-auto"
            onClick={handleSave}
            disabled={saving || !isDirty}
          >
            {saving ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
