"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import {
  Package, Scissors, Search, X, ChevronLeft, ChevronRight,
  Users, Tag, Sparkles, Loader2, Check, Image as ImageIcon,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────

type ItemOption = { id: string; name: string; price: number; imageUrl?: string | null };
type PreviewCustomer = { id: string; name: string; phone: string | null; lastPurchase: string | null; totalVisits?: number };

// ── Step Indicator ─────────────────────────────────────────────

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2 px-6 py-4 border-b border-border/60">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`h-7 w-7 rounded-full border flex items-center justify-center text-xs font-semibold transition-colors ${
            i + 1 < step  ? "bg-primary border-primary text-primary-foreground" :
            i + 1 === step ? "bg-primary/15 border-primary text-primary" :
                             "bg-surface-800 border-border text-muted-foreground"
          }`}>
            {i + 1 < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </div>
          {i < total - 1 && <div className={`h-px flex-1 w-6 ${i + 1 < step ? "bg-primary" : "bg-border"}`} />}
        </div>
      ))}
      <span className="ml-1 text-xs text-muted-foreground">{step} de {total}</span>
    </div>
  );
}

// ── Main Wizard ────────────────────────────────────────────────

export function OfertaWizard({ shopSlug }: { shopSlug: string | null }) {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1 state
  const [type, setType]                   = useState<"product" | "service">("product");
  const [selectedItems, setSelectedItems] = useState<ItemOption[]>([]);
  const [itemSearch, setItemSearch]       = useState("");
  const [itemResults, setItemResults]     = useState<ItemOption[]>([]);
  const [itemSearching, setItemSearching] = useState(false);
  const searchTimeout                     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 2 state
  const [days, setDays]                       = useState(30);
  const [previewLoading, setPreviewLoading]   = useState(false);
  const [previewCount, setPreviewCount]       = useState<number | null>(null);
  const [previewCustomers, setPreviewCustomers] = useState<PreviewCustomer[]>([]);
  const [previewDone, setPreviewDone]         = useState(false);
  // Never-bought pool
  const [neverBoughtCount, setNeverBoughtCount] = useState(0);
  const [neverBoughtOpen, setNeverBoughtOpen]   = useState(false);
  const [neverSearch, setNeverSearch]           = useState("");
  const [neverResults, setNeverResults]         = useState<PreviewCustomer[]>([]);
  const [neverSearching, setNeverSearching]     = useState(false);
  const [neverPage, setNeverPage]               = useState(1);
  const [neverHasMore, setNeverHasMore]         = useState(false);
  const [neverBrowseList, setNeverBrowseList]   = useState<PreviewCustomer[]>([]);
  const [neverBrowseLoading, setNeverBrowseLoading] = useState(false);
  const neverSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const neverListRef = useRef<HTMLDivElement>(null);
  // Manual customer selection
  const [manualCustomers, setManualCustomers] = useState<PreviewCustomer[]>([]);
  const [customerSearch, setCustomerSearch]   = useState("");
  const [customerResults, setCustomerResults] = useState<PreviewCustomer[]>([]);
  const [customerSearching, setCustomerSearching] = useState(false);
  const customerSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 3 state
  const [hasDiscount, setHasDiscount]   = useState(false);
  const [discountPct, setDiscountPct]   = useState("10");

  // Step 4 state
  const [title, setTitle]               = useState("");
  const [template, setTemplate]         = useState("");
  const [generating, setGenerating]     = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [mediaImageUrl, setMediaImageUrl] = useState<string | null>(null);

  // ── Item Search ──────────────────────────────────────────────

  const searchItems = useCallback(async (q: string) => {
    setItemSearching(true);
    try {
      const url = type === "product"
        ? `/api/products?q=${encodeURIComponent(q)}`
        : `/api/services`;
      const res = await fetch(url);
      const data = await res.json();
      const raw: ItemOption[] = type === "product"
        ? (data.products ?? [])
        : (data.services ?? []);
      setItemResults(raw.filter((r) => !selectedItems.some((s) => s.id === r.id)));
    } finally { setItemSearching(false); }
  }, [type, selectedItems]);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchItems(itemSearch), 300);
  }, [itemSearch, searchItems]);

  useEffect(() => { searchItems(""); }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  // When an item with imageUrl is selected (only for products), auto-set the mediaImageUrl
  useEffect(() => {
    if (type === "product" && selectedItems.length === 1 && selectedItems[0].imageUrl) {
      setMediaImageUrl(selectedItems[0].imageUrl);
    } else {
      setMediaImageUrl(null);
    }
  }, [selectedItems, type]);

  function addItem(item: ItemOption) {
    setSelectedItems((prev) => {
      if (prev.some((i) => i.id === item.id)) return prev;
      return [...prev, item];
    });
    setItemSearch("");
  }

  function removeItem(id: string) {
    setSelectedItems((prev) => prev.filter((i) => i.id !== id));
  }

  // ── Never-bought search + browse ──────────────────────────────

  const neverBoughtApiBase = useCallback(() => {
    const ids = selectedItems.map((i) => i.id).join(",");
    return `/api/targeted-offers/preview?type=${type}&ids=${encodeURIComponent(ids)}&never=true`;
  }, [type, selectedItems]);

  const searchNeverBought = useCallback(async (q: string) => {
    if (!q.trim()) { setNeverResults([]); return; }
    setNeverSearching(true);
    try {
      const res = await fetch(`${neverBoughtApiBase()}&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      const existing = new Set([...manualCustomers.map((c) => c.id), ...previewCustomers.map((c) => c.id)]);
      setNeverResults((data.customers ?? []).filter((c: PreviewCustomer) => !existing.has(c.id)));
    } finally { setNeverSearching(false); }
  }, [neverBoughtApiBase, manualCustomers, previewCustomers]);

  const loadNeverBrowsePage = useCallback(async (pg: number, append = false) => {
    setNeverBrowseLoading(true);
    try {
      const res = await fetch(`${neverBoughtApiBase()}&browse=true&page=${pg}`);
      const data = await res.json();
      const existing = new Set(manualCustomers.map((c) => c.id));
      const rows = (data.customers ?? []).filter((c: PreviewCustomer) => !existing.has(c.id));
      setNeverBrowseList((prev) => append ? [...prev, ...rows] : rows);
      setNeverHasMore(data.hasMore ?? false);
      setNeverPage(pg);
    } finally { setNeverBrowseLoading(false); }
  }, [neverBoughtApiBase, manualCustomers]);

  useEffect(() => {
    if (neverSearchTimeout.current) clearTimeout(neverSearchTimeout.current);
    if (neverSearch.trim()) {
      neverSearchTimeout.current = setTimeout(() => searchNeverBought(neverSearch), 300);
    } else {
      setNeverResults([]);
    }
  }, [neverSearch, searchNeverBought]);

  function addAllNeverBrowse() {
    const existing = new Set(manualCustomers.map((c) => c.id));
    const toAdd = neverBrowseList.filter((c) => !existing.has(c.id));
    setManualCustomers((prev) => [...prev, ...toAdd]);
    setNeverBrowseList([]);
  }

  // ── Customer search (manual) ──────────────────────────────────

  const searchCustomers = useCallback(async (q: string) => {
    if (!q.trim()) { setCustomerResults([]); return; }
    setCustomerSearching(true);
    try {
      const res = await fetch(`/api/customers/search?q=${encodeURIComponent(q)}&limit=10`);
      const data = await res.json();
      const all: PreviewCustomer[] = (data.customers ?? []).map((c: { id: string; name: string; phone: string | null }) => ({
        id: c.id, name: c.name, phone: c.phone, lastPurchase: null,
      }));
      // Filter out already added (manual or preview)
      const existingIds = new Set([...manualCustomers.map((c) => c.id), ...previewCustomers.map((c) => c.id)]);
      setCustomerResults(all.filter((c) => !existingIds.has(c.id)));
    } finally { setCustomerSearching(false); }
  }, [manualCustomers, previewCustomers]);

  useEffect(() => {
    if (customerSearchTimeout.current) clearTimeout(customerSearchTimeout.current);
    if (customerSearch.trim()) {
      customerSearchTimeout.current = setTimeout(() => searchCustomers(customerSearch), 300);
    } else {
      setCustomerResults([]);
    }
  }, [customerSearch, searchCustomers]);

  function addManualCustomer(c: PreviewCustomer) {
    setManualCustomers((prev) => prev.some((p) => p.id === c.id) ? prev : [...prev, c]);
    setCustomerSearch("");
    setCustomerResults([]);
  }

  function removeManualCustomer(id: string) {
    setManualCustomers((prev) => prev.filter((c) => c.id !== id));
  }

  // ── Preview ──────────────────────────────────────────────────

  const loadPreview = useCallback(async () => {
    if (!selectedItems.length) return;
    setPreviewLoading(true);
    setPreviewDone(false);
    try {
      const ids = selectedItems.map((i) => i.id).join(",");
      const res = await fetch(`/api/targeted-offers/preview?type=${type}&ids=${encodeURIComponent(ids)}&days=${days}`);
      const data = await res.json();
      setPreviewCount(data.count ?? 0);
      setPreviewCustomers(data.customers ?? []);
      setNeverBoughtCount(data.neverBoughtCount ?? 0);
      setPreviewDone(true);
    } catch {
      toast({ title: "Erro ao carregar prévia", variant: "destructive" });
    } finally { setPreviewLoading(false); }
  }, [selectedItems, type, days]);

  useEffect(() => {
    if (step === 2) loadPreview();
  }, [step, days, loadPreview]);

  // ── Auto-fill title + generate template on step 4 entry ──────

  useEffect(() => {
    if (step === 4) {
      if (!title) {
        const names = selectedItems.map((i) => i.name).join(" + ");
        const suffix = hasDiscount && discountPct ? ` — ${discountPct}% OFF` : "";
        setTitle(`${names}${suffix}`);
      }
      if (!template) {
        generateTemplate();
      }
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  async function generateTemplate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/targeted-offers/generate-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemNames:   selectedItems.map((i) => i.name),
          days,
          hasDiscount,
          discountPct: hasDiscount ? parseInt(discountPct || "0", 10) : null,
          productUrl:  type === "product" && selectedItems.length === 1 && shopSlug
            ? `${window.location.origin}/loja/${shopSlug}/p/${selectedItems[0].id}`
            : null,
        }),
      });
      const data = await res.json();
      if (data.template) {
        setTemplate(data.template);
      } else {
        throw new Error(data.message ?? "Erro");
      }
    } catch (err) {
      const names = selectedItems.map((i) => i.name).join(", ");
      setTemplate(`Olá {nome}! 👋\n\nSentimos sua falta! Temos uma oferta especial esperando por você: ${names}${hasDiscount && discountPct ? ` com ${discountPct}% de desconto` : ""}.\n\nVenha nos visitar, será um prazer atendê-lo novamente! 😊`);
      toast({ title: "IA indisponível, usando template padrão", variant: "destructive" });
    } finally { setGenerating(false); }
  }

  // ── Submit ───────────────────────────────────────────────────

  async function handleSubmit() {
    if (!title.trim()) { toast({ title: "Dê um título à oferta", variant: "destructive" }); return; }
    if (!template.trim()) { toast({ title: "Escreva o template da mensagem", variant: "destructive" }); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/targeted-offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          type,
          referenceIds:   selectedItems.map((i) => i.id),
          referenceNames: selectedItems.map((i) => i.name),
          daysInactive:   days,
          discount:       hasDiscount,
          discountPct:    hasDiscount ? parseInt(discountPct, 10) : null,
          messageTemplate: template,
          mediaImageUrl,
          manualCustomerIds: manualCustomers.map((c) => c.id),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Erro ao criar oferta");
      toast({ title: `Oferta criada! ${data.customersCount} mensagem(ns) na fila do WhatsApp.` });
      router.push(`/ofertas/${data.id}`);
    } catch (err) {
      toast({ title: "Erro", description: String(err), variant: "destructive" });
    } finally { setSubmitting(false); }
  }

  // ── Renders ──────────────────────────────────────────────────

  const canNext1 = selectedItems.length > 0;
  const totalCustomers = (previewCount ?? 0) + manualCustomers.filter((mc) => !previewCustomers.some((pc) => pc.id === mc.id)).length;
  const canNext2 = previewDone && totalCustomers > 0 || manualCustomers.length > 0;
  const canNext3 = true;
  const canSubmit = title.trim().length > 0 && template.trim().length > 0;

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6">
      <div className="max-w-lg mx-auto bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
        <StepIndicator step={step} total={4} />

        <div className="p-6 space-y-5">

          {/* ── STEP 1: Tipo + Seleção ────────────────────────── */}
          {step === 1 && (
            <>
              <div>
                <p className="text-base font-semibold text-foreground">O que você quer oferecer?</p>
                <p className="text-xs text-muted-foreground mt-0.5">Selecione o tipo e os itens da oferta</p>
              </div>

              {/* Type toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => { setType("product"); setSelectedItems([]); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-colors ${type === "product" ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground hover:bg-surface-700"}`}
                >
                  <Package className="h-4 w-4" /> Produto
                </button>
                <button
                  onClick={() => { setType("service"); setSelectedItems([]); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-colors ${type === "service" ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground hover:bg-surface-700"}`}
                >
                  <Scissors className="h-4 w-4" /> Serviço
                </button>
              </div>

              {/* Selected items */}
              {selectedItems.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-xs font-medium text-primary">
                      {item.imageUrl && <ImageIcon className="h-3 w-3 shrink-0" />}
                      {item.name}
                      <button onClick={() => removeItem(item.id)} className="hover:text-red-400 transition-colors">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Search */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  {itemSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                  <Input
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    placeholder={type === "product" ? "Buscar produto..." : "Buscar serviço..."}
                    className="pl-9"
                  />
                </div>
                {itemResults.length > 0 && (
                  <div className="rounded-lg border border-border bg-surface-800 divide-y divide-border max-h-48 overflow-y-auto">
                    {itemResults.slice(0, 10).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => addItem(item)}
                        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-surface-700 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {item.imageUrl && <ImageIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                          <span className="text-sm text-foreground truncate">{item.name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0 ml-2">
                          {item.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── STEP 2: Dias + Prévia ─────────────────────────── */}
          {step === 2 && (
            <>
              <div>
                <p className="text-base font-semibold text-foreground">Quem vai receber?</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Selecione clientes por inatividade, que nunca compraram, ou manualmente.
                </p>
              </div>

              {/* Slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-muted-foreground">Dias sem comprar</label>
                  <span className="text-lg font-bold text-primary">{days} dias</span>
                </div>
                <input
                  type="range"
                  min={7}
                  max={365}
                  step={7}
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  onMouseUp={() => loadPreview()}
                  onTouchEnd={() => loadPreview()}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>7 dias</span>
                  <span>1 ano</span>
                </div>
              </div>

              {/* Preview */}
              <div className="rounded-xl bg-surface-800 border border-border p-4 space-y-3">
                {previewLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Calculando clientes elegíveis...
                  </div>
                ) : previewDone ? (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xl font-bold text-foreground">{previewCount}</p>
                        <p className="text-xs text-muted-foreground">clientes elegíveis (com telefone)</p>
                      </div>
                    </div>
                    {previewCustomers.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {previewCustomers.slice(0, 5).map((c) => c.name).join(", ")}
                        {(previewCount ?? 0) > 5 && ` +${(previewCount ?? 0) - 5} mais`}
                      </div>
                    )}
                    {(previewCount ?? 0) === 0 && manualCustomers.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Nenhum cliente elegível. Tente aumentar o número de dias, selecionar outros itens ou adicionar manualmente abaixo.
                      </p>
                    )}
                  </>
                ) : null}
              </div>

              {/* Never bought section */}
              {previewDone && neverBoughtCount > 0 && (
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      const opening = !neverBoughtOpen;
                      setNeverBoughtOpen(opening);
                      setNeverSearch("");
                      setNeverResults([]);
                      if (opening && neverBrowseList.length === 0) loadNeverBrowsePage(1);
                    }}
                    className="w-full flex items-center justify-between rounded-xl bg-surface-800 border border-border p-3 hover:bg-surface-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                        <Users className="h-4 w-4 text-purple-400" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-foreground">{neverBoughtCount} nunca compraram</p>
                        <p className="text-[10px] text-muted-foreground">Clientes que nunca usaram {selectedItems.map((i) => i.name).join(", ")}</p>
                      </div>
                    </div>
                    <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${neverBoughtOpen ? "rotate-90" : ""}`} />
                  </button>

                  {neverBoughtOpen && (
                    <div className="rounded-xl border border-purple-500/20 bg-surface-800/50 p-3 space-y-2">
                      {/* Search */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <input
                          type="text"
                          value={neverSearch}
                          onChange={(e) => setNeverSearch(e.target.value)}
                          placeholder="Buscar por nome..."
                          autoFocus
                          className="w-full rounded-md border border-border bg-surface-800 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-purple-500/30"
                        />
                        {neverSearching && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        )}
                      </div>

                      {/* Search results */}
                      {neverSearch.trim() && neverResults.length > 0 && (
                        <div className="rounded-md border border-border bg-surface-800 divide-y divide-border max-h-48 overflow-y-auto">
                          {neverResults.map((c) => (
                            <button
                              key={c.id}
                              onClick={() => { addManualCustomer(c); setNeverResults((prev) => prev.filter((r) => r.id !== c.id)); }}
                              className="w-full flex items-center justify-between px-3 py-2 text-sm text-foreground hover:bg-surface-700 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <span>{c.name}</span>
                                {(c.totalVisits ?? 0) > 0 && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-surface-700 text-muted-foreground">{c.totalVisits} visitas</span>
                                )}
                              </div>
                              <span className="text-[10px] text-purple-400">+ adicionar</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Browse list (paginated, scroll) — shown when NOT searching */}
                      {!neverSearch.trim() && (
                        <>
                          {/* Actions */}
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] text-muted-foreground">Ordenados por mais visitas</p>
                            {neverBrowseList.length > 0 && (
                              <button
                                onClick={addAllNeverBrowse}
                                className="text-[10px] font-medium text-purple-400 hover:text-purple-300 transition-colors"
                              >
                                + Marcar todos da página
                              </button>
                            )}
                          </div>

                          <div
                            ref={neverListRef}
                            className="rounded-md border border-border bg-surface-800 divide-y divide-border max-h-52 overflow-y-auto"
                          >
                            {neverBrowseList.map((c) => {
                              const alreadyAdded = manualCustomers.some((mc) => mc.id === c.id);
                              return (
                                <button
                                  key={c.id}
                                  onClick={() => { if (!alreadyAdded) addManualCustomer(c); }}
                                  disabled={alreadyAdded}
                                  className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                                    alreadyAdded ? "opacity-40 cursor-default" : "text-foreground hover:bg-surface-700"
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span>{c.name}</span>
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-surface-700 text-muted-foreground">
                                      {c.totalVisits ?? 0} visitas
                                    </span>
                                  </div>
                                  {alreadyAdded
                                    ? <Check className="h-3 w-3 text-green-400" />
                                    : <span className="text-[10px] text-purple-400">+ adicionar</span>}
                                </button>
                              );
                            })}
                            {neverBrowseLoading && (
                              <div className="flex justify-center py-3">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              </div>
                            )}
                          </div>

                          {neverHasMore && !neverBrowseLoading && (
                            <button
                              onClick={() => loadNeverBrowsePage(neverPage + 1, true)}
                              className="w-full text-center text-xs text-purple-400 hover:text-purple-300 py-1 transition-colors"
                            >
                              Carregar mais...
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Manual customer add */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Adicionar clientes manualmente</p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Buscar por nome..."
                    className="w-full rounded-md border border-border bg-surface-800 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  {customerSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  )}
                </div>
                {customerResults.length > 0 && (
                  <div className="rounded-md border border-border bg-surface-800 divide-y divide-border max-h-40 overflow-y-auto">
                    {customerResults.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => addManualCustomer(c)}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm text-foreground hover:bg-surface-700 transition-colors"
                      >
                        <span>{c.name}</span>
                        {c.phone ? (
                          <span className="text-[10px] text-muted-foreground">{c.phone}</span>
                        ) : (
                          <span className="text-[10px] text-red-400">sem tel</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {manualCustomers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {manualCustomers.map((c) => (
                      <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-1 text-xs text-foreground">
                        {c.name}
                        <button onClick={() => removeManualCustomer(c.id)} className="hover:text-red-400">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Total count */}
              {(manualCustomers.length > 0 || (previewCount ?? 0) > 0) && (
                <p className="text-xs text-muted-foreground">
                  Total: <strong className="text-foreground">{totalCustomers}</strong> cliente(s) receberão a oferta
                </p>
              )}
            </>
          )}

          {/* ── STEP 3: Desconto ─────────────────────────────── */}
          {step === 3 && (
            <>
              <div>
                <p className="text-base font-semibold text-foreground">Você vai oferecer desconto?</p>
                <p className="text-xs text-muted-foreground mt-0.5">Opcional — aumenta a taxa de resposta</p>
              </div>

              <div className="space-y-3">
                <label className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${!hasDiscount ? "bg-primary/10 border-primary" : "border-border hover:bg-surface-700"}`}>
                  <input type="radio" checked={!hasDiscount} onChange={() => setHasDiscount(false)} className="sr-only" />
                  <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${!hasDiscount ? "border-primary bg-primary" : "border-border"}`}>
                    {!hasDiscount && <div className="h-2 w-2 rounded-full bg-white" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Não, só uma oferta de volta</p>
                    <p className="text-xs text-muted-foreground">Convite para retornar sem desconto específico</p>
                  </div>
                </label>

                <label className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${hasDiscount ? "bg-primary/10 border-primary" : "border-border hover:bg-surface-700"}`}>
                  <input type="radio" checked={hasDiscount} onChange={() => setHasDiscount(true)} className="sr-only" />
                  <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${hasDiscount ? "border-primary bg-primary" : "border-border"}`}>
                    {hasDiscount && <div className="h-2 w-2 rounded-full bg-white" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Sim, com desconto</p>
                    <p className="text-xs text-muted-foreground">Define um percentual de desconto</p>
                  </div>
                </label>

                {hasDiscount && (
                  <div className="space-y-2 pt-1">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5" /> Percentual de desconto
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <Input
                          value={discountPct}
                          onChange={(e) => setDiscountPct(e.target.value.replace(/\D/, ""))}
                          className="pr-8 text-xl font-bold text-center"
                          inputMode="numeric"
                          max={99}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">%</span>
                      </div>
                    </div>
                    {selectedItems.length === 1 && (
                      <div className="rounded-lg bg-surface-800 border border-border p-3 text-sm">
                        <span className="text-muted-foreground">Preço original: </span>
                        <span className="font-medium">{selectedItems[0].price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                        <span className="text-muted-foreground"> → </span>
                        <span className="font-bold text-green-400">
                          {(selectedItems[0].price * (1 - parseInt(discountPct || "0", 10) / 100)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── STEP 4: Template + Envio ─────────────────────── */}
          {step === 4 && (
            <>
              <div>
                <p className="text-base font-semibold text-foreground">Mensagem e envio</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Template enviado para {totalCustomers} cliente{totalCustomers !== 1 ? "s" : ""}. Use {"{nome}"} para personalizar.
                </p>
              </div>

              {/* Title */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Título da oferta *</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Promoção Café com Leite"
                  autoFocus
                />
              </div>

              {/* Template */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">Template da mensagem *</label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={generateTemplate}
                    disabled={generating}
                    className="h-7 text-xs gap-1.5 bg-purple-600 hover:bg-purple-500 text-white px-3"
                  >
                    {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    Gerar com IA
                  </Button>
                </div>
                {generating ? (
                  <div className="rounded-xl border border-border bg-surface-800 h-32 flex items-center justify-center">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Gerando mensagem...
                    </div>
                  </div>
                ) : (
                  <textarea
                    value={template}
                    onChange={(e) => setTemplate(e.target.value)}
                    placeholder={`Olá {nome}! Sentimos sua falta...\n\nTemos uma oferta especial...`}
                    rows={5}
                    className="w-full rounded-xl border border-border bg-surface-800 px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  />
                )}
              </div>

              {/* Image preview info */}
              {mediaImageUrl && (
                <div className="flex items-center gap-3 rounded-xl bg-primary/5 border border-primary/20 p-3">
                  <ImageIcon className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">Foto do produto incluída</p>
                    <p className="text-[10px] text-muted-foreground">A mensagem será enviada como imagem com legenda no WhatsApp</p>
                  </div>
                  <button onClick={() => setMediaImageUrl(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Preview of first customer */}
              {(() => {
                const firstCustomer = previewCustomers[0] ?? manualCustomers[0];
                return firstCustomer && template && !generating ? (
                  <div className="rounded-xl bg-surface-800 border border-border p-3 space-y-1">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Prévia para {firstCustomer.name}</p>
                    <p className="text-xs text-foreground whitespace-pre-wrap">
                      {template.replace(/\{nome\}/gi, firstCustomer.name)}
                    </p>
                  </div>
                ) : null;
              })()}
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-3 p-6 pt-0 border-t border-border/60 mt-2">
          {step > 1 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)} className="gap-2">
              <ChevronLeft className="h-4 w-4" /> Voltar
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => router.push("/ofertas")} className="gap-2">
              <ChevronLeft className="h-4 w-4" /> Cancelar
            </Button>
          )}

          <div className="flex-1" />

          {step < 4 ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={
                (step === 1 && !canNext1) ||
                (step === 2 && !canNext2)
              }
              className="gap-2 bg-gold-500 hover:bg-gold-400 text-black"
            >
              Próximo <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="gap-2 bg-gold-500 hover:bg-gold-400 text-black"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Enviar para {totalCustomers} cliente{totalCustomers !== 1 ? "s" : ""}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
