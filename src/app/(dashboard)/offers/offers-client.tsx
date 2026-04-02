"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/utils";
import {
  Tag, Plus, Package, Crown, Zap, X, Check, Loader2,
  ChevronDown, Tag as TagIcon,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

const TYPE_LABEL   = { PACKAGE: "Pacote", COMBO: "Combo", SUBSCRIPTION: "Assinatura VIP", FLASH_PROMO: "Promoção Relâmpago", PREPAID: "Crédito Pré-pago" };
const TYPE_ICON    = { PACKAGE: Package, COMBO: TagIcon, SUBSCRIPTION: Crown, FLASH_PROMO: Zap, PREPAID: Tag };
const STATUS_LABEL = { ACTIVE: "Ativa", DRAFT: "Rascunho", PAUSED: "Pausada", EXPIRED: "Expirada", ARCHIVED: "Arquivada" };
const STATUS_CLASS: Record<string, string> = {
  ACTIVE:   "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  DRAFT:    "bg-muted/30 text-muted-foreground border-border",
  PAUSED:   "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  EXPIRED:  "bg-red-500/15 text-red-400 border-red-500/30",
  ARCHIVED: "bg-muted/20 text-muted-foreground border-border",
};
const CAT_LABEL = { HAIRCUT: "Corte", BEARD: "Barba", COMBO: "Combo", TREATMENT: "Tratamento", OTHER: "Outro" };

interface OfferItemData {
  id:          string;
  serviceId:   string;
  serviceName: string;
  category:    string;
  quantity:    number;
  unitPrice:   number;
  discountPct: number;
}

interface Offer {
  id:               string;
  type:             string;
  status:           string;
  title:            string;
  description:      string | null;
  originalPrice:    number;
  salePrice:        number;
  credits:          number | null;
  validUntil:       string | null;
  maxRedemptions:   number | null;
  redemptionsCount: number;
  items:            OfferItemData[];
}

interface AvailableService {
  id:       string;
  name:     string;
  category: string;
  price:    number;
}

interface Props {
  initialOffers:     Offer[];
  availableServices: AvailableService[];
}

// ── Creation drawer ───────────────────────────────────────────
function CreateOfferDrawer({
  services,
  onClose,
  onCreated,
}: {
  services: AvailableService[];
  onClose: () => void;
  onCreated: (offer: Offer) => void;
}) {
  const [title, setTitle]           = useState("");
  const [description, setDesc]      = useState("");
  const [type, setType]             = useState("COMBO");
  const [validUntil, setValidUntil] = useState("");
  const [maxRed, setMaxRed]         = useState("");
  const [saving, setSaving]         = useState(false);
  const [selected, setSelected]     = useState<Record<string, number>>({}); // serviceId → discountPct

  function toggleService(svc: AvailableService) {
    setSelected((prev) => {
      if (prev[svc.id] !== undefined) {
        const next = { ...prev };
        delete next[svc.id];
        return next;
      }
      return { ...prev, [svc.id]: 0 };
    });
  }

  const selectedList = services.filter((s) => selected[s.id] !== undefined);
  const originalTotal = selectedList.reduce((sum, s) => sum + s.price, 0);
  const saleTotal     = selectedList.reduce((sum, s) => sum + s.price * (1 - (selected[s.id] ?? 0) / 100), 0);
  const totalDiscount = originalTotal > 0 ? Math.round((1 - saleTotal / originalTotal) * 100) : 0;

  async function handleCreate() {
    if (!title.trim()) { toast({ title: "Informe o título", variant: "destructive" }); return; }
    if (!selectedList.length) { toast({ title: "Selecione ao menos um serviço", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const res  = await fetch("/api/offers", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          title: title.trim(), description: description.trim() || undefined, type,
          items: selectedList.map((s) => ({ serviceId: s.id, discountPct: selected[s.id] ?? 0 })),
          validUntil: validUntil || undefined,
          maxRedemptions: maxRed ? Number(maxRed) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao criar oferta");
      onCreated(data.offer as Offer);
      toast({ title: "Oferta criada!" });
      onClose();
    } catch (e) {
      toast({ title: "Erro", description: String(e), variant: "destructive" });
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Nova oferta</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-surface-700 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          {/* Title + type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <label className="text-xs text-muted-foreground">Título *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="ex: Combo Corte + Barba" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Tipo</label>
              <div className="relative">
                <select value={type} onChange={(e) => setType(e.target.value)}
                  className="w-full appearance-none rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring pr-8">
                  {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Validade</label>
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)}
                className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-xs text-muted-foreground">Descrição</label>
              <input value={description} onChange={(e) => setDesc(e.target.value)}
                className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Descrição curta (opcional)" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Máx. resgates</label>
              <input type="number" min="1" value={maxRed} onChange={(e) => setMaxRed(e.target.value)}
                placeholder="Ilimitado"
                className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
          </div>

          {/* Service selection */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">Serviços incluídos *</p>
            <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
              {services.map((svc) => {
                const isSelected = selected[svc.id] !== undefined;
                const discount   = selected[svc.id] ?? 0;
                return (
                  <div key={svc.id} className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${isSelected ? "bg-gold-500/8" : "hover:bg-surface-800/40"}`}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleService(svc)}
                      className="h-4 w-4 accent-gold-500 cursor-pointer" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{svc.name}</p>
                      <p className="text-[10px] text-muted-foreground">{CAT_LABEL[svc.category as keyof typeof CAT_LABEL]} · {formatBRL(svc.price)}</p>
                    </div>
                    {isSelected && (
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="number" min="0" max="100" value={discount}
                          onChange={(e) => setSelected((prev) => ({ ...prev, [svc.id]: Math.min(100, Math.max(0, Number(e.target.value))) }))}
                          className="w-14 rounded border border-border bg-surface-800 px-2 py-1 text-xs text-foreground text-right focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        <span className="text-[10px] text-muted-foreground">% desc</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Price preview */}
          {selectedList.length > 0 && (
            <div className="rounded-lg border border-gold-500/20 bg-gold-500/5 p-3 space-y-1.5">
              <p className="text-xs font-medium text-gold-400">Resumo da oferta</p>
              {selectedList.map((s) => {
                const disc = selected[s.id] ?? 0;
                const final = s.price * (1 - disc / 100);
                return (
                  <div key={s.id} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground truncate mr-2">{s.name}{disc > 0 ? ` (-${disc}%)` : ""}</span>
                    <span className="text-foreground shrink-0">{formatBRL(final)}</span>
                  </div>
                );
              })}
              <div className="border-t border-gold-500/20 pt-1.5 flex items-center justify-between">
                <span className="text-xs text-muted-foreground line-through">{formatBRL(originalTotal)}</span>
                <div className="flex items-center gap-2">
                  {totalDiscount > 0 && (
                    <span className="rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] px-1.5 py-0.5">-{totalDiscount}%</span>
                  )}
                  <span className="text-base font-bold text-gold-400">{formatBRL(saleTotal)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border px-5 py-3 flex gap-2 justify-end">
          <Button variant="ghost" size="sm" className="text-xs" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button size="sm" className="text-xs gap-1" onClick={handleCreate} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            {saving ? "Criando..." : "Criar oferta"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export function OffersClient({ initialOffers, availableServices }: Props) {
  const [offers, setOffers]         = useState(initialOffers);
  const [showCreate, setShowCreate] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function toggleStatus(offer: Offer) {
    const nextStatus = offer.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setTogglingId(offer.id);
    try {
      const res  = await fetch(`/api/offers/${offer.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body:   JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar");
      setOffers((prev) => prev.map((o) => o.id === offer.id ? { ...o, status: nextStatus } : o));
    } catch (e) {
      toast({ title: "Erro", description: String(e), variant: "destructive" });
    } finally { setTogglingId(null); }
  }

  return (
    <>
      {showCreate && (
        <CreateOfferDrawer
          services={availableServices}
          onClose={() => setShowCreate(false)}
          onCreated={(offer) => setOffers((prev) => [offer, ...prev])}
        />
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{offers.length} oferta{offers.length !== 1 ? "s" : ""} criada{offers.length !== 1 ? "s" : ""}</p>
          <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setShowCreate(true)}>
            <Plus className="h-3.5 w-3.5" /> Nova oferta
          </Button>
        </div>

        {offers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gold-500/20 bg-card p-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gold-500/10">
              <Tag className="h-6 w-6 text-gold-400" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Nenhuma oferta criada</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
              Crie combos de serviços com desconto ou promoções relâmpago para fidelizar clientes.
            </p>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Criar primeira oferta
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {offers.map((o) => {
              const Icon     = TYPE_ICON[o.type as keyof typeof TYPE_ICON] ?? Tag;
              const discount = o.originalPrice > 0 ? Math.round((1 - o.salePrice / o.originalPrice) * 100) : 0;

              return (
                <div key={o.id} className="rounded-lg border border-border bg-card p-5 hover:border-gold-500/30 transition-colors flex flex-col">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold-500/10 border border-gold-500/20">
                      <Icon className="h-5 w-5 text-gold-400" />
                    </div>
                    <div className="flex gap-1.5 items-center">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_CLASS[o.status] ?? STATUS_CLASS.DRAFT}`}>
                        {STATUS_LABEL[o.status as keyof typeof STATUS_LABEL] ?? o.status}
                      </span>
                      <Badge variant="outline" className="text-[10px]">{TYPE_LABEL[o.type as keyof typeof TYPE_LABEL] ?? o.type}</Badge>
                    </div>
                  </div>

                  <h3 className="font-semibold text-foreground">{o.title}</h3>
                  {o.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{o.description}</p>}

                  {/* Items list */}
                  {o.items.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {o.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground truncate">{item.serviceName}</span>
                          <span className="text-foreground shrink-0">
                            {item.discountPct > 0
                              ? <><span className="line-through text-muted-foreground mr-1">{formatBRL(item.unitPrice)}</span>{formatBRL(item.unitPrice * (1 - item.discountPct / 100))}</>
                              : formatBRL(item.unitPrice)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-4">
                    <p className="text-xl font-bold text-gold-400">{formatBRL(o.salePrice)}</p>
                    {discount > 0 && (
                      <>
                        <p className="text-xs text-muted-foreground line-through">{formatBRL(o.originalPrice)}</p>
                        <span className="rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] px-1.5 py-0.5 border border-emerald-500/20">-{discount}%</span>
                      </>
                    )}
                  </div>

                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                    {o.credits && <span>{o.credits} sessões</span>}
                    {o.validUntil && <span>Até {new Date(o.validUntil).toLocaleDateString("pt-BR")}</span>}
                    {o.maxRedemptions && <span>{o.redemptionsCount}/{o.maxRedemptions} resgates</span>}
                  </div>

                  <div className="mt-4 pt-3 border-t border-border">
                    <Button
                      size="sm"
                      variant={o.status === "ACTIVE" ? "outline" : "default"}
                      className="w-full h-7 text-xs"
                      onClick={() => toggleStatus(o)}
                      disabled={togglingId === o.id || ["EXPIRED", "ARCHIVED"].includes(o.status)}
                    >
                      {togglingId === o.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : o.status === "ACTIVE" ? "Pausar" : "Ativar"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
