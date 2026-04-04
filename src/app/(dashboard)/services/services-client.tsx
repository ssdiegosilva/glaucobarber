"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/utils";
import {
  Scissors, Pencil, Check, X, Loader2, Sparkles, TrendingUp,
  ChevronDown, ChevronUp, Plus, Lightbulb, MapPin, Navigation,
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
  location:       string;
}

interface BarbershopLocation {
  address: string | null;
  city:    string | null;
  state:   string | null;
}

interface Props {
  initialServices:      Service[];
  initialOpportunities: Opportunity[];
  hasTrinks:            boolean;
  barbershopLocation:   BarbershopLocation;
}

// ── Address capture modal ─────────────────────────────────────
function AddressModal({
  onSave,
  onClose,
}: {
  onSave: (loc: BarbershopLocation) => void;
  onClose: () => void;
}) {
  const [address, setAddress] = useState("");
  const [city, setCity]       = useState("");
  const [state, setState]     = useState("");
  const [saving, setSaving]   = useState(false);
  const [locating, setLocating] = useState(false);

  async function handleGPS() {
    if (!navigator.geolocation) {
      toast({ title: "Geolocalização não disponível neste navegador", variant: "destructive" });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=pt-BR`,
            { headers: { "User-Agent": "GlaucoBarber/1.0" } }
          );
          const data = await res.json();
          const addr = data.address ?? {};
          setAddress([addr.road, addr.house_number].filter(Boolean).join(", ") || "");
          setCity(addr.city || addr.town || addr.village || addr.municipality || "");
          setState(addr.state || "");
        } catch {
          toast({ title: "Não foi possível obter o endereço", description: "Preencha manualmente", variant: "destructive" });
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        toast({ title: "Permissão de localização negada", description: "Preencha o endereço manualmente", variant: "destructive" });
      }
    );
  }

  async function handleSave() {
    if (!city.trim() && !address.trim()) {
      toast({ title: "Informe ao menos a cidade", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/barbershop/location", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ address: address.trim(), city: city.trim(), state: state.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar endereço");
      onSave({ address: address.trim() || null, city: city.trim() || null, state: state.trim() || null });
      toast({ title: "Endereço salvo!", description: "A IA usará este endereço nas sugestões." });
      onClose();
    } catch (e) {
      toast({ title: "Erro ao salvar", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-purple-400" />
            <h2 className="font-semibold text-foreground text-sm">Endereço da barbearia</h2>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-surface-700 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            A IA usa o endereço da sua barbearia para sugerir serviços populares na sua região. Isso também atualiza o perfil da barbearia nas configurações.
          </p>

          <Button
            variant="outline"
            size="sm"
            className="w-full h-9 text-xs gap-2 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
            onClick={handleGPS}
            disabled={locating}
          >
            {locating
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Navigation className="h-3.5 w-3.5" />}
            {locating ? "Obtendo localização..." : "Usar minha localização atual"}
          </Button>

          <div className="relative flex items-center gap-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] text-muted-foreground shrink-0">ou preencha manualmente</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Endereço (rua e número)</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ex: Rua das Flores, 123"
                className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Cidade *</label>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ex: São Paulo"
                  className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Estado</label>
                <input
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="Ex: SP"
                  className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
          </div>

          {(address || city) && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground rounded-md bg-surface-800/60 px-3 py-2">
              <MapPin className="h-3 w-3 text-purple-400 shrink-0" />
              <span className="truncate">{[address, city, state].filter(Boolean).join(", ")}</span>
            </div>
          )}
        </div>

        <div className="border-t border-border px-5 py-3 flex gap-2 justify-end">
          <Button variant="ghost" size="sm" className="text-xs" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button size="sm" className="text-xs gap-1" onClick={handleSave} disabled={saving || (!address.trim() && !city.trim())}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            {saving ? "Salvando..." : "Salvar e continuar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ServicesClient({ initialServices, initialOpportunities, hasTrinks, barbershopLocation }: Props) {
  const [services, setServices]                   = useState(initialServices);
  const [opportunities, setOpportunities]         = useState(initialOpportunities);
  const [editingId, setEditingId]                 = useState<string | null>(null);
  const [editPrice, setEditPrice]                 = useState("");
  const [editDuration, setEditDuration]           = useState("");
  const [saving, setSaving]                       = useState(false);
  const [loadingAI, setLoadingAI]                 = useState<string | null>(null);
  const [recommendations, setRecommendations]     = useState<Record<string, PriceRecommendation>>({});
  const [expandedRec, setExpandedRec]             = useState<string | null>(null);
  const [selectedPrices, setSelectedPrices]       = useState<Record<string, number>>({});
  const [expandedOpps, setExpandedOpps]           = useState<Set<string>>(new Set());
  const [generatingOpps, setGeneratingOpps]       = useState(false);
  const [approvingId, setApprovingId]             = useState<string | null>(null);
  const [rejectingId, setRejectingId]             = useState<string | null>(null);
  const [location, setLocation]                   = useState<BarbershopLocation>(barbershopLocation);
  const [showAddressModal, setShowAddressModal]   = useState(false);
  const [pendingGenerate, setPendingGenerate]     = useState(false);

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
    setLoadingAI(svc.id);
    try {
      const res  = await fetch(`/api/services/${svc.id}/recommend-price`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro na IA");
      window.dispatchEvent(new Event("ai-used"));
      setRecommendations((prev) => ({ ...prev, [svc.id]: data as PriceRecommendation }));
      setSelectedPrices((prev) => ({ ...prev, [svc.id]: (data as PriceRecommendation).suggestedPrice }));
      setExpandedRec(svc.id);
    } catch (e) {
      toast({ title: "Erro na recomendação", description: String(e), variant: "destructive" });
    } finally { setLoadingAI(null); }
  }

  const hasLocation = !!(location.address || location.city);

  async function doGenerate() {
    setGeneratingOpps(true);
    setPendingGenerate(false);
    try {
      const res  = await fetch("/api/services/opportunities/generate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "ADDRESS_REQUIRED") {
          setShowAddressModal(true);
          setPendingGenerate(true);
          return;
        }
        throw new Error(data.error ?? "Erro ao gerar");
      }
      window.dispatchEvent(new Event("ai-used"));
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

  async function generateOpportunities() {
    if (!hasLocation) {
      setShowAddressModal(true);
      setPendingGenerate(true);
      return;
    }
    await doGenerate();
  }

  function handleAddressSaved(loc: BarbershopLocation) {
    setLocation(loc);
    if (pendingGenerate) {
      doGenerate();
    }
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
    <>
      {showAddressModal && (
        <AddressModal
          onSave={handleAddressSaved}
          onClose={() => { setShowAddressModal(false); setPendingGenerate(false); }}
        />
      )}

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
          <div className="flex flex-col items-end gap-1">
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
            {hasLocation ? (
              <button
                onClick={() => setShowAddressModal(true)}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-purple-400 transition-colors"
              >
                <MapPin className="h-2.5 w-2.5" />
                {[location.city, location.state].filter(Boolean).join(", ")}
              </button>
            ) : (
              <button
                onClick={() => { setShowAddressModal(true); setPendingGenerate(true); }}
                className="flex items-center gap-1 text-[10px] text-amber-400/80 hover:text-amber-400 transition-colors"
              >
                <MapPin className="h-2.5 w-2.5" />
                Adicionar endereço para melhores sugestões
              </button>
            )}
          </div>
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
                {opp.description && (
                  <div className="mt-1">
                    <p className={`text-xs text-muted-foreground ${expandedOpps.has(opp.id) ? "" : "line-clamp-2"}`}>
                      {opp.description}
                    </p>
                  </div>
                )}
                <div className="mt-2">
                  <p className={`text-xs text-purple-300/80 leading-relaxed ${expandedOpps.has(opp.id) ? "" : "line-clamp-3"}`}>
                    {opp.rationale}
                  </p>
                  <button
                    onClick={() => setExpandedOpps((prev) => {
                      const next = new Set(prev);
                      next.has(opp.id) ? next.delete(opp.id) : next.add(opp.id);
                      return next;
                    })}
                    className="text-[10px] text-purple-400/70 hover:text-purple-400 transition-colors mt-1"
                  >
                    {expandedOpps.has(opp.id) ? "Ver menos" : "Ver mais"}
                  </button>
                </div>

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
                        className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity rounded p-1 hover:bg-surface-700"
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
                      onClick={() => rec ? setExpandedRec(isExpanded ? null : s.id) : fetchRecommendation(s)}
                      disabled={loadingAI === s.id}
                      className="mt-3 flex items-center gap-1.5 text-[11px] text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50 py-2 -my-2"
                    >
                      {loadingAI === s.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : rec
                          ? (isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)
                          : <Sparkles className="h-3 w-3" />}
                      {rec
                        ? (isExpanded ? "Ocultar sugestão" : "Ver sugestão")
                        : (loadingAI === s.id ? "Consultando IA..." : "Sugerir preço com IA")}
                    </button>

                    {rec && isExpanded && (() => {
                      const chosen = selectedPrices[s.id] ?? rec.suggestedPrice;
                      const step   = 1;
                      return (
                        <div className="mt-2 rounded-lg border border-purple-500/20 bg-purple-500/8 p-3 space-y-2.5">
                          <div className="flex items-center gap-1.5">
                            <TrendingUp className="h-3.5 w-3.5 text-purple-400" />
                            <span className="text-xs font-semibold text-purple-300">Recomendação da IA</span>
                            <span className="ml-auto text-[10px] text-purple-400/70 capitalize">{rec.marketPosition}</span>
                          </div>
                          {rec.location && (
                            <div className="flex items-center gap-1 text-[10px] text-purple-300/70">
                              <MapPin className="h-2.5 w-2.5" />
                              Baseado em barbearias em <span className="font-semibold text-purple-300 ml-0.5">{rec.location}</span>
                            </div>
                          )}
                          <p className="text-[11px] text-muted-foreground leading-relaxed">{rec.rationale}</p>
                          {/* Price slider */}
                          <div className="space-y-1.5">
                            <div className="flex items-baseline justify-between">
                              <span className="text-[10px] text-muted-foreground">Escolha o preço</span>
                              <span className="text-lg font-bold text-purple-300">{formatBRL(chosen)}</span>
                            </div>
                            <input
                              type="range"
                              min={rec.minPrice}
                              max={rec.maxPrice}
                              step={step}
                              value={chosen}
                              onChange={(e) => setSelectedPrices((prev) => ({ ...prev, [s.id]: Number(e.target.value) }))}
                              className="w-full h-1.5 rounded-full accent-purple-500 cursor-pointer"
                            />
                            <div className="flex justify-between text-[9px] text-muted-foreground">
                              <span>Mín {formatBRL(rec.minPrice)}</span>
                              <span className="text-purple-400/60">Sugerido {formatBRL(rec.suggestedPrice)}</span>
                              <span>Máx {formatBRL(rec.maxPrice)}</span>
                            </div>
                          </div>
                          <div className="flex gap-2 pt-0.5">
                            <Button
                              size="sm"
                              className="h-7 text-xs flex-1 bg-purple-600 hover:bg-purple-500"
                              onClick={() => applyRecommendation(s.id, chosen)}
                              disabled={saving}
                            >
                              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Check className="h-3 w-3 mr-1" />Aplicar {formatBRL(chosen)}</>}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
                              onClick={() => { setRecommendations((prev) => { const n = { ...prev }; delete n[s.id]; return n; }); setExpandedRec(null); }}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })()}
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
    </>
  );
}
