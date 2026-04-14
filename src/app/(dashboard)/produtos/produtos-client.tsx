"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Plus, Package, Pencil, Trash2, Loader2, Search, ToggleLeft, ToggleRight } from "lucide-react";

type Product = {
  id: string;
  name: string;
  price: number;
  category: string | null;
  description: string | null;
  active: boolean;
  createdAt: string;
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ── Product Modal ─────────────────────────────────────────────

function ProductModal({
  product,
  onClose,
  onSaved,
}: {
  product?: Product;
  onClose: () => void;
  onSaved: (p: Product) => void;
}) {
  const [name, setName]         = useState(product?.name ?? "");
  const [price, setPrice]       = useState(product ? String(product.price).replace(".", ",") : "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [description, setDesc]  = useState(product?.description ?? "");
  const [saving, setSaving]     = useState(false);
  const isEdit = !!product;

  async function handleSave() {
    if (!name.trim()) { toast({ title: "Nome é obrigatório", variant: "destructive" }); return; }
    const priceNum = parseFloat(price.replace(",", "."));
    if (isNaN(priceNum) || priceNum < 0) { toast({ title: "Preço inválido", variant: "destructive" }); return; }

    setSaving(true);
    try {
      const url  = isEdit ? `/api/products/${product.id}` : "/api/products";
      const method = isEdit ? "PATCH" : "POST";
      const res  = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), price: priceNum, category: category.trim() || undefined, description: description.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar");
      toast({ title: isEdit ? "Produto atualizado!" : "Produto criado!" });
      onSaved(data.product);
      onClose();
    } catch (err) {
      toast({ title: "Erro", description: String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
      <div className="bg-surface-900 border border-border rounded-2xl w-full max-w-md space-y-4 p-6 shadow-2xl">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
            <Package className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-base font-semibold text-foreground">
            {isEdit ? "Editar produto" : "Novo produto"}
          </h2>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Nome *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Pão francês, Shampoo..." autoFocus />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Preço *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
              <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" className="pl-9" inputMode="decimal" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Categoria (opcional)</label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex: Pães, Bebidas, Shampoo..." />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Descrição (opcional)</label>
            <Input value={description} onChange={(e) => setDesc(e.target.value)} placeholder="Detalhes do produto..." />
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="ghost" onClick={onClose} className="flex-1" disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} className="flex-1 bg-gold-500 hover:bg-gold-400 text-black" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (isEdit ? "Salvar" : "Criar")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────

export function ProdutosClient({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts]     = useState<Product[]>(initialProducts);
  const [search, setSearch]         = useState("");
  const [showModal, setShowModal]   = useState(false);
  const [editing, setEditing]       = useState<Product | undefined>();
  const [toggling, setToggling]     = useState<string | null>(null);
  const [deleting, setDeleting]     = useState<string | null>(null);

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  function handleSaved(p: Product) {
    setProducts((prev) => {
      const idx = prev.findIndex((x) => x.id === p.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = p; return next.sort((a, b) => a.name.localeCompare(b.name)); }
      return [...prev, p].sort((a, b) => a.name.localeCompare(b.name));
    });
  }

  async function toggleActive(p: Product) {
    setToggling(p.id);
    try {
      const res = await fetch(`/api/products/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !p.active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProducts((prev) => prev.map((x) => x.id === p.id ? data.product : x));
    } catch {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    } finally {
      setToggling(null);
    }
  }

  async function handleDelete(p: Product) {
    if (!confirm(`Remover "${p.name}"?`)) return;
    setDeleting(p.id);
    try {
      const res = await fetch(`/api/products/${p.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setProducts((prev) => prev.filter((x) => x.id !== p.id));
      toast({ title: "Produto removido" });
    } catch {
      toast({ title: "Erro ao remover", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
      {/* Header row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produto..." className="pl-9" />
        </div>
        <Button onClick={() => { setEditing(undefined); setShowModal(true); }} className="bg-gold-500 hover:bg-gold-400 text-black gap-2 shrink-0">
          <Plus className="h-4 w-4" /> Adicionar produto
        </Button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <div className="h-14 w-14 rounded-2xl bg-surface-800 border border-border flex items-center justify-center">
            <Package className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">
            {search ? "Nenhum produto encontrado" : "Nenhum produto cadastrado"}
          </p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Cadastre seus produtos para selecioná-los rapidamente ao registrar uma visita.
          </p>
          {!search && (
            <Button onClick={() => { setEditing(undefined); setShowModal(true); }} className="mt-2 bg-gold-500 hover:bg-gold-400 text-black gap-2">
              <Plus className="h-4 w-4" /> Adicionar primeiro produto
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="divide-y divide-border">
            {filtered.map((p) => (
              <div key={p.id} className={`flex items-center gap-3 px-4 py-3 transition-colors ${p.active ? "hover:bg-surface-800/40" : "opacity-50 hover:bg-surface-800/40"}`}>
                <div className="h-9 w-9 rounded-full bg-surface-800 border border-border flex items-center justify-center shrink-0">
                  <span className="text-xs font-semibold text-foreground">{p.name.charAt(0).toUpperCase()}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                  {p.category && (
                    <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-surface-700 border border-border text-muted-foreground mt-0.5">
                      {p.category}
                    </span>
                  )}
                </div>

                <p className="text-sm font-semibold text-foreground shrink-0">{formatCurrency(p.price)}</p>

                <button
                  onClick={() => toggleActive(p)}
                  disabled={toggling === p.id}
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  title={p.active ? "Desativar" : "Ativar"}
                >
                  {toggling === p.id
                    ? <Loader2 className="h-5 w-5 animate-spin" />
                    : p.active
                      ? <ToggleRight className="h-5 w-5 text-green-400" />
                      : <ToggleLeft className="h-5 w-5" />}
                </button>

                <button
                  onClick={() => { setEditing(p); setShowModal(true); }}
                  className="shrink-0 h-7 w-7 rounded-md border border-border flex items-center justify-center hover:bg-surface-700 transition-colors"
                  title="Editar"
                >
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </button>

                <button
                  onClick={() => handleDelete(p)}
                  disabled={deleting === p.id}
                  className="shrink-0 h-7 w-7 rounded-md border border-red-500/30 bg-red-500/10 flex items-center justify-center hover:bg-red-500/20 transition-colors"
                  title="Remover"
                >
                  {deleting === p.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin text-red-400" />
                    : <Trash2 className="h-3.5 w-3.5 text-red-400" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <ProductModal
          product={editing}
          onClose={() => { setShowModal(false); setEditing(undefined); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
