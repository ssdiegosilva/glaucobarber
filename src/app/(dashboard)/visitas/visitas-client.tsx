"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Plus, User, Clock, DollarSign, MessageCircle, Search, Loader2, ShoppingBag, Package, Minus, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type VisitCustomer = { id: string; name: string; phone: string | null } | null;

type VisitItem = { id: string; name: string; price: number; quantity: number; productId: string | null };

type Visit = {
  id: string;
  visitedAt: string;
  amount: number | null;
  notes: string | null;
  source: string;
  customer: VisitCustomer;
  items: VisitItem[];
};

type SearchCustomer = {
  id: string;
  name: string;
  phone: string | null;
  postSaleStatus: string | null;
  totalVisits: number;
};

type SearchProduct = {
  id: string;
  name: string;
  price: number;
  category: string | null;
};

type CartItem = {
  productId: string | null; // null = will be created inline
  name: string;
  price: number;
  quantity: number;
};

interface Props {
  initialVisits: Visit[];
  totalAmount: number;
  tenantLabel: string;
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatTime(iso: string) {
  return format(new Date(iso), "HH:mm", { locale: ptBR });
}

// ── Register Visit Modal ─────────────────────────────────────

function RegisterModal({
  tenantLabel,
  onClose,
  onSaved,
}: {
  tenantLabel: string;
  onClose: () => void;
  onSaved: (visit: Visit) => void;
}) {
  // Customer state
  const [q, setQ]                         = useState("");
  const [searching, setSearching]         = useState(false);
  const [results, setResults]             = useState<SearchCustomer[]>([]);
  const [selected, setSelected]           = useState<SearchCustomer | null>(null);
  const [newName, setNewName]             = useState("");
  const [newPhone, setNewPhone]           = useState("");
  const [mode, setMode]                   = useState<"search" | "new">("search");

  // Product state
  const [pq, setPq]                       = useState("");
  const [pSearching, setPSearching]       = useState(false);
  const [pResults, setPResults]           = useState<SearchProduct[]>([]);
  const [cart, setCart]                   = useState<CartItem[]>([]);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newProdName, setNewProdName]     = useState("");
  const [newProdPrice, setNewProdPrice]   = useState("");

  // Other
  const [amount, setAmount]               = useState("");
  const [notes, setNotes]                 = useState("");
  const [saving, setSaving]               = useState(false);
  const searchTimeout                     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pSearchTimeout                    = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Customer search ──────────────────────────────────────
  const searchCustomers = useCallback(async (query: string) => {
    if (query.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/customers/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.customers ?? []);
    } finally { setSearching(false); }
  }, []);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchCustomers(q), 300);
  }, [q, searchCustomers]);

  // ── Product search ───────────────────────────────────────
  const searchProducts = useCallback(async (query: string) => {
    setPSearching(true);
    try {
      const res = await fetch(`/api/products?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setPResults(data.products ?? []);
    } finally { setPSearching(false); }
  }, []);

  useEffect(() => {
    if (pSearchTimeout.current) clearTimeout(pSearchTimeout.current);
    pSearchTimeout.current = setTimeout(() => searchProducts(pq), 300);
  }, [pq, searchProducts]);

  // Load all products on mount for quick access
  useEffect(() => { searchProducts(""); }, [searchProducts]);

  // ── Cart helpers ─────────────────────────────────────────
  function addToCart(product: SearchProduct) {
    setPq("");
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.productId === product.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, { productId: product.id, name: product.name, price: product.price, quantity: 1 }];
    });
  }

  function addInlineProduct() {
    const name = newProdName.trim();
    const price = parseFloat(newProdPrice.replace(",", "."));
    if (!name) { toast({ title: "Nome é obrigatório", variant: "destructive" }); return; }
    if (isNaN(price) || price < 0) { toast({ title: "Preço inválido", variant: "destructive" }); return; }
    setCart((prev) => [...prev, { productId: null, name, price, quantity: 1 }]);
    setNewProdName("");
    setNewProdPrice("");
    setShowNewProduct(false);
  }

  function changeQty(idx: number, delta: number) {
    setCart((prev) => {
      const next = [...prev];
      const newQty = next[idx].quantity + delta;
      if (newQty <= 0) return next.filter((_, i) => i !== idx);
      next[idx] = { ...next[idx], quantity: newQty };
      return next;
    });
  }

  function removeItem(idx: number) {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  }

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const hasItems = cart.length > 0;

  // ── Save ─────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        notes: notes || undefined,
        source: "manual",
      };

      if (mode === "search" && selected) {
        body.customerId = selected.id;
      } else if (mode === "new") {
        body.customerName = newName.trim() || undefined;
        body.phone        = newPhone.trim() || undefined;
      }

      if (hasItems) {
        body.items = cart.map((i) => ({
          productId: i.productId ?? undefined,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
        }));
      } else {
        body.amount = amount ? parseFloat(amount.replace(",", ".")) : undefined;
      }

      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao registrar");
      toast({ title: "Visita registrada!" });
      onSaved(data.visit);
      onClose();
    } catch (err) {
      toast({ title: "Erro", description: String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
      <div className="bg-surface-900 border border-border rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col">
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Header */}
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gold-500/15 border border-gold-500/30 flex items-center justify-center">
              <ShoppingBag className="h-4 w-4 text-gold-400" />
            </div>
            <h2 className="text-base font-semibold text-foreground">Registrar visita</h2>
          </div>

          {/* Customer mode toggle */}
          <div className="flex gap-2 text-xs">
            <button onClick={() => setMode("search")} className={`px-3 py-1.5 rounded-full border transition-colors ${mode === "search" ? "bg-gold-500/15 border-gold-500/40 text-gold-400" : "border-border text-muted-foreground hover:text-foreground"}`}>
              Buscar cliente
            </button>
            <button onClick={() => setMode("new")} className={`px-3 py-1.5 rounded-full border transition-colors ${mode === "new" ? "bg-gold-500/15 border-gold-500/40 text-gold-400" : "border-border text-muted-foreground hover:text-foreground"}`}>
              Novo cliente
            </button>
            <button onClick={() => { setMode("search"); setSelected(null); setQ(""); }} className="px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground transition-colors">
              Anônimo
            </button>
          </div>

          {/* Customer search */}
          {mode === "search" && !selected && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome ou telefone…" className="pl-9" autoFocus />
              </div>
              {results.length > 0 && (
                <div className="rounded-lg border border-border bg-surface-800 divide-y divide-border max-h-40 overflow-y-auto">
                  {results.map((c) => (
                    <button key={c.id} onClick={() => { setSelected(c); setQ(c.name); }} className="w-full flex items-center justify-between px-3 py-2 hover:bg-surface-700 transition-colors text-left">
                      <div>
                        <p className="text-sm font-medium text-foreground">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.phone ?? "—"}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{c.totalVisits}x</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {mode === "search" && selected && (
            <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/30 px-3 py-2">
              <User className="h-4 w-4 text-green-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{selected.name}</p>
                <p className="text-xs text-muted-foreground">{selected.phone ?? "—"} · {selected.totalVisits} visita(s)</p>
              </div>
              <button onClick={() => { setSelected(null); setQ(""); }} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
            </div>
          )}

          {mode === "new" && (
            <div className="space-y-2">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome (opcional)" />
              <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Telefone (opcional)" type="tel" />
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-border/60" />

          {/* Product section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" /> Produtos
              </p>
              <button onClick={() => setShowNewProduct((v) => !v)} className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
                <Plus className="h-3 w-3" /> Novo produto
              </button>
            </div>

            {/* Inline new product form */}
            {showNewProduct && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                <p className="text-xs font-medium text-primary">Criar e adicionar produto</p>
                <Input value={newProdName} onChange={(e) => setNewProdName(e.target.value)} placeholder="Nome do produto" autoFocus />
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                  <Input value={newProdPrice} onChange={(e) => setNewProdPrice(e.target.value)} placeholder="0,00" className="pl-9" inputMode="decimal" />
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="flex-1 h-8 text-xs" onClick={() => { setShowNewProduct(false); setNewProdName(""); setNewProdPrice(""); }}>Cancelar</Button>
                  <Button size="sm" className="flex-1 h-8 text-xs bg-primary hover:bg-primary/90 text-white" onClick={addInlineProduct}>Criar e adicionar</Button>
                </div>
              </div>
            )}

            {/* Product search */}
            {!showNewProduct && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                {pSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                <Input
                  value={pq}
                  onChange={(e) => setPq(e.target.value)}
                  placeholder="Buscar produto do catálogo…"
                  className="pl-8 h-9 text-sm"
                />
              </div>
            )}

            {pResults.length > 0 && !showNewProduct && (
              <div className="rounded-lg border border-border bg-surface-800 divide-y divide-border max-h-36 overflow-y-auto">
                {pResults
                  .filter((p) => !cart.some((c) => c.productId === p.id))
                  .slice(0, 8)
                  .map((p) => (
                    <button key={p.id} onClick={() => addToCart(p)} className="w-full flex items-center justify-between px-3 py-2 hover:bg-surface-700 transition-colors text-left">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                        {p.category && <p className="text-xs text-muted-foreground">{p.category}</p>}
                      </div>
                      <span className="text-xs font-semibold text-foreground shrink-0 ml-2">{formatCurrency(p.price)}</span>
                    </button>
                  ))}
              </div>
            )}

            {/* Cart */}
            {cart.length > 0 && (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="divide-y divide-border/60">
                  {cart.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 px-3 py-2">
                      <span className="flex-1 text-sm text-foreground truncate">{item.name}</span>
                      {item.productId === null && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-primary/15 text-primary border border-primary/30 shrink-0">novo</span>
                      )}
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => changeQty(idx, -1)} className="h-5 w-5 rounded border border-border flex items-center justify-center hover:bg-surface-700 transition-colors">
                          <Minus className="h-3 w-3 text-muted-foreground" />
                        </button>
                        <span className="text-xs font-medium text-foreground w-4 text-center">{item.quantity}</span>
                        <button onClick={() => changeQty(idx, 1)} className="h-5 w-5 rounded border border-border flex items-center justify-center hover:bg-surface-700 transition-colors">
                          <Plus className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                      <span className="text-xs font-semibold text-foreground w-14 text-right shrink-0">{formatCurrency(item.price * item.quantity)}</span>
                      <button onClick={() => removeItem(idx)} className="h-5 w-5 flex items-center justify-center text-muted-foreground hover:text-red-400 transition-colors shrink-0">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="px-3 py-2 bg-surface-800/60 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Total</span>
                  <span className="text-sm font-bold text-foreground">{formatCurrency(cartTotal)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Manual amount — only when no items in cart */}
          {!hasItems && (
            <>
              <div className="border-t border-border/60" />
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Valor total (opcional)" className="pl-9" inputMode="decimal" />
              </div>
            </>
          )}

          {/* Notes */}
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observação (opcional)" />
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 pt-0">
          <Button variant="ghost" onClick={onClose} className="flex-1" disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} className="flex-1 bg-gold-500 hover:bg-gold-400 text-black" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Client Component ─────────────────────────────────────

export function VisitasClient({ initialVisits, totalAmount: initialTotal, tenantLabel }: Props) {
  const [visits, setVisits]       = useState<Visit[]>(initialVisits);
  const [total, setTotal]         = useState(initialTotal);
  const [showModal, setShowModal] = useState(false);

  function handleSaved(visit: Visit) {
    setVisits((prev) => [visit, ...prev]);
    setTotal((prev) => prev + (visit.amount ?? 0));
  }

  function openWhatsApp(phone: string | null, name: string) {
    if (!phone) return;
    const clean = phone.replace(/\D/g, "");
    const full  = clean.startsWith("55") ? clean : `55${clean}`;
    const msg   = encodeURIComponent(`Olá ${name}! Obrigado pela sua visita 😊`);
    window.open(`https://wa.me/${full}?text=${msg}`, "_blank");
  }

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <User className="h-4 w-4" />
            <span className="font-medium text-foreground">{visits.length}</span> visita{visits.length !== 1 ? "s" : ""} hoje
          </span>
          <span className="flex items-center gap-1.5">
            <DollarSign className="h-4 w-4" />
            <span className="font-medium text-foreground">{formatCurrency(total)}</span> em compras
          </span>
        </div>
        <Button onClick={() => setShowModal(true)} className="bg-gold-500 hover:bg-gold-400 text-black gap-2">
          <Plus className="h-4 w-4" /> Registrar visita
        </Button>
      </div>

      {/* List */}
      {visits.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <div className="h-14 w-14 rounded-2xl bg-surface-800 border border-border flex items-center justify-center">
            <ShoppingBag className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">Nenhuma visita registrada hoje</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Registre as visitas dos clientes para ativar o acompanhamento pós-venda automático pelo WhatsApp.
          </p>
          <Button onClick={() => setShowModal(true)} className="mt-2 bg-gold-500 hover:bg-gold-400 text-black gap-2">
            <Plus className="h-4 w-4" /> Registrar primeira visita
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="divide-y divide-border">
            {visits.map((v) => (
              <div key={v.id} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-800/40 transition-colors">
                <div className="h-9 w-9 rounded-full bg-surface-800 border border-border flex items-center justify-center shrink-0">
                  {v.customer ? (
                    <span className="text-xs font-semibold text-foreground">{v.customer.name.charAt(0).toUpperCase()}</span>
                  ) : (
                    <User className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {v.customer?.name ?? <span className="text-muted-foreground italic">Anônimo</span>}
                  </p>
                  {v.items.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {v.items.map((item, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-700 border border-border text-muted-foreground">
                          {item.quantity > 1 ? `${item.quantity}× ` : ""}{item.name}
                        </span>
                      ))}
                    </div>
                  ) : v.notes ? (
                    <p className="text-xs text-muted-foreground truncate">{v.notes}</p>
                  ) : null}
                </div>

                <div className="text-right shrink-0 space-y-0.5">
                  {v.amount != null && (
                    <p className="text-sm font-semibold text-foreground">{formatCurrency(v.amount)}</p>
                  )}
                  <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                    <Clock className="h-3 w-3" />
                    {formatTime(v.visitedAt)}
                  </p>
                </div>

                {v.customer?.phone && (
                  <button
                    onClick={() => openWhatsApp(v.customer!.phone, v.customer!.name)}
                    className="h-8 w-8 rounded-lg border border-green-500/30 bg-green-500/10 flex items-center justify-center hover:bg-green-500/20 transition-colors shrink-0"
                    title="Enviar WhatsApp"
                  >
                    <MessageCircle className="h-4 w-4 text-green-400" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <RegisterModal
          tenantLabel={tenantLabel}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
