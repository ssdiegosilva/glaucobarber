"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/utils";
import { Scissors, Pencil, Check, X, Loader2, Sparkles, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const CATEGORY_LABEL   = { HAIRCUT: "Corte", BEARD: "Barba", COMBO: "Combo", TREATMENT: "Tratamento", OTHER: "Outro" };
const CATEGORY_VARIANT = { HAIRCUT: "default", BEARD: "info", COMBO: "success", TREATMENT: "warning", OTHER: "outline" } as const;

interface Service {
  id:               string;
  name:             string;
  description:      string | null;
  category:         string;
  price:            number;
  durationMin:      number;
  active:           boolean;
  syncedFromTrinks: boolean;
}

interface PriceRecommendation {
  suggestedPrice: number;
  minPrice:       number;
  maxPrice:       number;
  marketPosition: string;
  rationale:      string;
}

interface Props {
  initialServices: Service[];
  hasTrinks:       boolean;
}

export function ServicesClient({ initialServices, hasTrinks }: Props) {
  const [services, setServices]           = useState(initialServices);
  const [editingId, setEditingId]         = useState<string | null>(null);
  const [editPrice, setEditPrice]         = useState("");
  const [editDuration, setEditDuration]   = useState("");
  const [saving, setSaving]               = useState(false);
  const [loadingAI, setLoadingAI]         = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<Record<string, PriceRecommendation>>({});
  const [expandedRec, setExpandedRec]     = useState<string | null>(null);

  function startEdit(svc: Service) {
    setEditingId(svc.id);
    setEditPrice(String(svc.price));
    setEditDuration(String(svc.durationMin));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditPrice("");
    setEditDuration("");
  }

  async function saveEdit(id: string) {
    setSaving(true);
    try {
      const res  = await fetch(`/api/services/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ price: Number(editPrice), durationMin: Number(editDuration) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar");
      setServices((prev) => prev.map((s) => s.id === id ? { ...s, price: Number(editPrice), durationMin: Number(editDuration) } : s));
      toast({ title: "Serviço atualizado" + (hasTrinks ? " (Trinks atualizado na próxima sincronização)" : "") });
      cancelEdit();
    } catch (e) {
      toast({ title: "Erro", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function applyRecommendation(svcId: string, price: number) {
    setSaving(true);
    try {
      const res  = await fetch(`/api/services/${svcId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ price }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar");
      setServices((prev) => prev.map((s) => s.id === svcId ? { ...s, price } : s));
      setRecommendations((prev) => { const next = { ...prev }; delete next[svcId]; return next; });
      setExpandedRec(null);
      toast({ title: "Preço atualizado para " + formatBRL(price) });
    } catch (e) {
      toast({ title: "Erro", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function fetchRecommendation(svc: Service) {
    if (loadingAI === svc.id) return;
    // Toggle: if already showing, hide it
    if (recommendations[svc.id]) {
      setRecommendations((prev) => { const next = { ...prev }; delete next[svc.id]; return next; });
      setExpandedRec(null);
      return;
    }
    setLoadingAI(svc.id);
    try {
      const res  = await fetch(`/api/services/${svc.id}/recommend-price`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro na IA");
      setRecommendations((prev) => ({ ...prev, [svc.id]: data as PriceRecommendation }));
      setExpandedRec(svc.id);
    } catch (e) {
      toast({ title: "Erro na recomendação", description: String(e), variant: "destructive" });
    } finally {
      setLoadingAI(null);
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {services.map((s) => {
        const isEditing = editingId === s.id;
        const rec       = recommendations[s.id];
        const isExpanded = expandedRec === s.id;

        return (
          <div key={s.id} className="rounded-lg border border-border bg-card p-4 hover:border-gold-500/20 transition-colors relative group flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold-500/10 border border-gold-500/20">
                <Scissors className="h-5 w-5 text-gold-400" />
              </div>
              <div className="flex gap-1.5 items-center">
                <Badge variant={CATEGORY_VARIANT[s.category as keyof typeof CATEGORY_VARIANT] as never} className="text-[10px]">
                  {CATEGORY_LABEL[s.category as keyof typeof CATEGORY_LABEL]}
                </Badge>
                {!s.active && <Badge variant="destructive" className="text-[10px]">Inativo</Badge>}
                {!isEditing && (
                  <button
                    onClick={() => startEdit(s)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity rounded p-1 hover:bg-surface-700"
                    title="Editar preço"
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>

            <p className="font-semibold text-foreground">{s.name}</p>
            {s.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.description}</p>}

            {/* Edit mode */}
            {isEditing ? (
              <div className="mt-3 space-y-2">
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] text-muted-foreground">Preço (R$)</label>
                    <input
                      type="number" min="0" step="0.01" value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      className="w-full rounded border border-border bg-surface-800 px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      autoFocus
                    />
                  </div>
                  <div className="w-20 space-y-1">
                    <label className="text-[10px] text-muted-foreground">Min</label>
                    <input
                      type="number" min="5" step="5" value={editDuration}
                      onChange={(e) => setEditDuration(e.target.value)}
                      className="w-full rounded border border-border bg-surface-800 px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="h-7 text-xs flex-1" onClick={() => saveEdit(s.id)} disabled={saving}>
                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Check className="h-3 w-3 mr-1" />Salvar</>}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={cancelEdit}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mt-4">
                  <p className="text-lg font-bold text-gold-400">{formatBRL(s.price)}</p>
                  <p className="text-xs text-muted-foreground">{s.durationMin} min</p>
                </div>

                {/* AI Recommendation button */}
                <button
                  onClick={() => fetchRecommendation(s)}
                  disabled={loadingAI === s.id}
                  className="mt-3 flex items-center gap-1.5 text-[11px] text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50"
                  title="Sugestão de preço por IA"
                >
                  {loadingAI === s.id
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Sparkles className="h-3 w-3" />}
                  {rec ? (isExpanded ? <><ChevronUp className="h-3 w-3" /> Ocultar sugestão</> : <><ChevronDown className="h-3 w-3" /> Ver sugestão</>)
                    : (loadingAI === s.id ? "Consultando IA..." : "Sugerir preço com IA")}
                </button>

                {/* Recommendation panel */}
                {rec && isExpanded && (
                  <div className="mt-2 rounded-lg border border-purple-500/20 bg-purple-500/8 p-3 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-purple-400" />
                      <span className="text-xs font-semibold text-purple-300">Recomendação da IA</span>
                      <span className="ml-auto text-[10px] text-purple-400/70 capitalize">{rec.marketPosition}</span>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold text-purple-300">{formatBRL(rec.suggestedPrice)}</span>
                      <span className="text-[10px] text-muted-foreground">
                        faixa: {formatBRL(rec.minPrice)} – {formatBRL(rec.maxPrice)}
                      </span>
                    </div>

                    <p className="text-[11px] text-muted-foreground leading-relaxed">{rec.rationale}</p>

                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        className="h-7 text-xs flex-1 bg-purple-600 hover:bg-purple-500"
                        onClick={() => applyRecommendation(s.id, rec.suggestedPrice)}
                        disabled={saving}
                      >
                        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Check className="h-3 w-3 mr-1" />Aplicar {formatBRL(rec.suggestedPrice)}</>}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => { setRecommendations((prev) => { const next = { ...prev }; delete next[s.id]; return next; }); setExpandedRec(null); }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {s.syncedFromTrinks && !isEditing && (
              <p className="text-[10px] text-muted-foreground/50 mt-2">Origem: Trinks</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
