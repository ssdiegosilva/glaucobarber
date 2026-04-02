"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/utils";
import {
  Scissors, Pencil, Check, X, Loader2, Sparkles, TrendingUp,
  ChevronDown, ChevronUp, Plus, Lightbulb,
} from "lucide-react";
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

interface Opportunity {
  id:             string;
  name:           string;
  category:       string;
  description:    string | null;
  suggestedPrice: number;
  rationale:      string;
}

interface PriceRecommendation {
  suggestedPrice: number;
  minPrice:       number;
  maxPrice:       number;
  marketPosition: string;
  rationale:      string;
}

interface Props {
  initialServices:      Service[];
  initialOpportunities: Opportunity[];
  hasTrinks:            boolean;
}

export function ServicesClient({ initialServices, initialOpportunities, hasTrinks }: Props) {
  const [services, setServices]                   = useState(initialServices);
  const [opportunities, setOpportunities]         = useState(initialOpportunities);
  const [editingId, setEditingId]                 = useState<string | null>(null);
  const [editPrice, setEditPrice]                 = useState("");
  const [editDuration, setEditDuration]           = useState("");
  const [saving, setSaving]                       = useState(false);
  const [loadingAI, setLoadingAI]                 = useState<string | null>(null);
  const [recommendations, setRecommendations]     = useState<Record<string, PriceRecommendation>>({});
  const [expandedRec, setExpandedRec]             = useState<string | null>(null);
  const [generatingOpps, setGeneratingOpps]       = useState(false);
  const [approvingId, setApprovingId]             = useState<string | null>(null);
  const [rejectingId, setRejectingId]             = useState<string | null>(null);

  function startEdit(svc: Service) {
    setEditingId(svc.id);
    setEditPrice(String(svc.price));
    setEditDuration(String(svc.durationMin));
  }
  function cancelEdit() { setEditingId(null); setEditPrice(""); setEditDuration(""); }

  async function saveEdit(id: string) {
    setSaving(true);
    try {
      const res  = await fetch(`/api/services/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body:   JSON.stringify({ price: Number(editPrice), durationMin: Number(editDuration) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar");
      setServices((prev) => prev.map((s) => s.id === id ? { ...s, price: Number(editPrice), durationMin: Number(editDuration) } : s));
      toast({ title: "Serviço atualizado" + (hasTrinks ? " (Trinks atualizado na próxima sincronização)" : "") });
      cancelEdit();
    } catch (e) {
      toast({ title: "Erro", description: String(e), variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function applyRecommendation(svcId: string, price: number) {
    setSaving(true);
    try {
      const res  = await fetch(`/api/services/${svcId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body:   JSON.stringify({ price }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar");
      setServices((prev) => prev.map((s) => s.id === svcId ? { ...s, price } : s));
      setRecommendations((prev) => { const n = { ...prev }; delete n[svcId]; return n; });
      setExpandedRec(null);
      toast({ title: "Preço atualizado para " + formatBRL(price) });
    } catch (e) {
      toast({ title: "Erro", description: String(e), variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function fetchRecommendation(svc: Service) {
    if (loadingAI === svc.id) return;
    if (recommendations[svc.id]) {
      setRecommendations((prev) => { const n = { ...prev }; delete n[svc.id]; return n; });
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
    } finally { setLoadingAI(null); }
  }

  async function generateOpportunities() {
    setGeneratingOpps(true);
    try {
      const res  = await fetch("/api/services/opportunities/generate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao gerar");
      setOpportunities(data.opportunities.map((o: Record<string, unknown>) => ({
        id:             String(o.id),
        name:           String(o.name),
        category:       String(o.category),
        description:    o.description ? String(o.description) : null,
        suggestedPrice: Number(o.suggestedPrice),
        rationale:      String(o.rationale),
      })));
      toast({ title: `${data.opportunities.length} oportunidades encontradas!` });
    } catch (e) {
      toast({ title: "Erro", description: String(e), variant: "destructive" });
    } finally { setGeneratingOpps(false); }
  }

  async function approveOpportunity(opp: Opportunity) {
    setApprovingId(opp.id);
    try {
      const res  = await fetch(`/api/services/opportunities/${opp.id}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao aprovar");
      // Add as normal service, remove from opportunities
      setServices((prev) => [...prev, { ...data.service, syncedFromTrinks: false }]);
      setOpportunities((prev) => prev.filter((o) => o.id !== opp.id));
      toast({ title: `"${opp.name}" adicionado ao catálogo!` });
    } catch (e) {
      toast({ title: "Erro", description: String(e), variant: "destructive" });
    } finally { setApprovingId(null); }
  }

  async function rejectOpportunity(id: string) {
    setRejectingId(id);
    try {
      await fetch(`/api/services/opportunities/${id}`, { method: "DELETE" });
      setOpportunities((prev) => prev.filter((o) => o.id !== id));
    } finally { setRejectingId(null); }
  }

  return (
    <div className="space-y-6">
      {/* ── Opportunity section ────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-foreground">Oportunidades de serviço</h3>
            {opportunities.length > 0 && (
              <span className="rounded-full bg-purple-500/20 text-purple-400 text-[10px] px-2 py-0.5 font-medium">
                {opportunities.length}
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
            onClick={generateOpportunities}
            disabled={generatingOpps}
          >
            {generatingOpps
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <Sparkles className="h-3 w-3" />}
            {generatingOpps ? "Consultando IA..." : "Descobrir oportunidades"}
          </Button>
        </div>

        {opportunities.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Clique em &quot;Descobrir oportunidades&quot; para a IA sugerir serviços populares na sua região que você ainda não oferece.
          </p>
        )}

        {opportunities.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {opportunities.map((opp) => (
              <div
                key={opp.id}
                className="rounded-lg border-2 border-dashed border-purple-500/40 bg-purple-500/5 p-4 flex flex-col"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/15 border border-purple-500/20">
                    <Plus className="h-5 w-5 text-purple-400" />
                  </div>
                  <div className="flex gap-1.5 items-center">
                    <span className="rounded-full bg-purple-500/20 text-purple-400 text-[10px] px-2 py-0.5 font-medium border border-purple-500/20">
                      Novo • Oportunidade
                    </span>
                    <Badge variant={CATEGORY_VARIANT[opp.category as keyof typeof CATEGORY_VARIANT] as never} className="text-[10px]">
                      {CATEGORY_LABEL[opp.category as keyof typeof CATEGORY_LABEL] ?? opp.category}
                    </Badge>
                  </div>
                </div>

                <p className="font-semibold text-foreground">{opp.name}</p>
                {opp.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{opp.description}</p>}
                <p className="text-xs text-purple-300/80 mt-2 line-clamp-3 leading-relaxed">{opp.rationale}</p>

                <div className="flex items-center justify-between mt-3">
                  <p className="text-lg font-bold text-purple-300">{formatBRL(opp.suggestedPrice)}</p>
                  <p className="text-[10px] text-muted-foreground">preço sugerido</p>
                </div>

                <div className="flex gap-2 mt-3 pt-3 border-t border-purple-500/20">
                  <Button
                    size="sm"
                    className="h-7 text-xs flex-1 bg-purple-600 hover:bg-purple-500"
                    onClick={() => approveOpportunity(opp)}
                    disabled={approvingId === opp.id}
                  >
                    {approvingId === opp.id
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <><Check className="h-3 w-3 mr-1" />Adicionar ao catálogo</>}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-muted-foreground hover:text-red-400"
                    onClick={() => rejectOpportunity(opp.id)}
                    disabled={rejectingId === opp.id}
                  >
                    {rejectingId === opp.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Existing services ──────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Scissors className="h-4 w-4 text-gold-400" />
          Catálogo atual
          <span className="text-xs text-muted-foreground font-normal">({services.length} serviços)</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((s) => {
            const isEditing  = editingId === s.id;
            const rec        = recommendations[s.id];
            const isExpanded = expandedRec === s.id;

            return (
              <div key={s.id} className="rounded-lg border border-border bg-card p-4 hover:border-gold-500/20 transition-colors relative group flex flex-col">
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

                    <button
                      onClick={() => fetchRecommendation(s)}
                      disabled={loadingAI === s.id}
                      className="mt-3 flex items-center gap-1.5 text-[11px] text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50"
                    >
                      {loadingAI === s.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Sparkles className="h-3 w-3" />}
                      {rec
                        ? (isExpanded
                          ? <><ChevronUp className="h-3 w-3" /> Ocultar sugestão</>
                          : <><ChevronDown className="h-3 w-3" /> Ver sugestão</>)
                        : (loadingAI === s.id ? "Consultando IA..." : "Sugerir preço com IA")}
                    </button>

                    {rec && isExpanded && (
                      <div className="mt-2 rounded-lg border border-purple-500/20 bg-purple-500/8 p-3 space-y-2">
                        <div className="flex items-center gap-1.5">
                          <TrendingUp className="h-3.5 w-3.5 text-purple-400" />
                          <span className="text-xs font-semibold text-purple-300">Recomendação da IA</span>
                          <span className="ml-auto text-[10px] text-purple-400/70 capitalize">{rec.marketPosition}</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-xl font-bold text-purple-300">{formatBRL(rec.suggestedPrice)}</span>
                          <span className="text-[10px] text-muted-foreground">faixa: {formatBRL(rec.minPrice)} – {formatBRL(rec.maxPrice)}</span>
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
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
                            onClick={() => { setRecommendations((prev) => { const n = { ...prev }; delete n[s.id]; return n; }); setExpandedRec(null); }}>
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
      </div>
    </div>
  );
}
