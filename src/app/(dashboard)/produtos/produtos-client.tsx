"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Plus, Package, Pencil, Trash2, Loader2, Search, ToggleLeft, ToggleRight, ImagePlus, X, Sparkles, Camera, ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";
import { isAiLimitError, triggerAiLimitModal } from "@/lib/ai-error";
import Image from "next/image";

type Product = {
  id: string;
  name: string;
  price: number;
  category: string | null;
  description: string | null;
  active: boolean;
  imageUrl: string | null;
  createdAt: string;
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ── Image Upload Component ─────────────────────────────────────

function ProductImageUpload({
  productId,
  currentUrl,
  onUploaded,
}: {
  productId: string;
  currentUrl: string | null;
  onUploaded: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Imagem acima de 5MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/products/${productId}/image`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao fazer upload");
      onUploaded(data.url);
      toast({ title: "Foto enviada!" });
    } catch (err) {
      toast({ title: "Erro no upload", description: String(err), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">Foto do produto (opcional)</label>
      <div className="mt-1 flex items-center gap-3">
        {currentUrl ? (
          <div className="relative h-16 w-16 rounded-lg overflow-hidden border border-border shrink-0">
            <Image src={currentUrl} alt="produto" fill className="object-cover" />
          </div>
        ) : (
          <div className="h-16 w-16 rounded-lg border border-dashed border-border flex items-center justify-center shrink-0 bg-surface-800">
            <ImagePlus className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="text-xs gap-1.5"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
            {currentUrl ? "Trocar foto" : "Adicionar foto"}
          </Button>
          <p className="text-[10px] text-muted-foreground">JPG, PNG ou WebP · máx. 5MB</p>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />
    </div>
  );
}

// ── New Product Wizard ────────────────────────────────────────

function NewProductWizard({ onClose, onSaved }: { onClose: () => void; onSaved: (p: Product) => void }) {
  const [step, setStep] = useState(1);

  // Step 1 state
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDesc] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Step 2 state
  const [price, setPrice] = useState("");
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<{ minPrice: number; maxPrice: number; suggestedPrice: number; note: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  function handlePhoto(file: File) {
    if (file.size > 5 * 1024 * 1024) { toast({ title: "Imagem acima de 5MB", variant: "destructive" }); return; }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function analyzeProduct() {
    if (!name.trim() && !photoPreview) return;
    setAnalyzing(true);
    try {
      let uploadedUrl: string | null = null;
      // If photo, upload first to get a URL for vision
      if (photoFile) {
        const form = new FormData();
        form.append("file", photoFile);
        // Use a temp endpoint or base64
        const reader = new FileReader();
        uploadedUrl = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(photoFile);
        });
      }

      const res = await fetch("/api/products/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || undefined, imageUrl: uploadedUrl }),
      });
      const data = await res.json();
      if (isAiLimitError(res.status, data)) { triggerAiLimitModal(); return; }

      if (data.name && !name.trim()) setName(data.name);
      if (data.category) setCategory(data.category);
      if (data.description) setDesc(data.description);
      setAnalyzed(true);
      toast({ title: "Produto analisado!" });
    } catch {
      toast({ title: "Erro na análise", variant: "destructive" });
    } finally { setAnalyzing(false); }
  }

  async function suggestPrice() {
    if (!name.trim()) return;
    setSuggestLoading(true);
    try {
      const res = await fetch("/api/products/suggest-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category, description }),
      });
      const data = await res.json();
      if (isAiLimitError(res.status, data)) { triggerAiLimitModal(); return; }
      if (data.error) { toast({ title: data.error, variant: "destructive" }); return; }
      setSuggestion(data);
      if (!price) setPrice(String(data.suggestedPrice).replace(".", ","));
    } catch {
      toast({ title: "Erro ao buscar preço", variant: "destructive" });
    } finally { setSuggestLoading(false); }
  }

  async function handleCreate() {
    if (!name.trim()) return;
    const priceNum = parseFloat(price.replace(",", "."));
    if (isNaN(priceNum) || priceNum < 0) { toast({ title: "Preço inválido", variant: "destructive" }); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          price: priceNum,
          category: category.trim() || undefined,
          description: description.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao criar");
      const product = { ...data.product, imageUrl: null };
      setCreatedId(data.product.id);

      // Upload photo if exists
      if (photoFile && data.product.id) {
        try {
          const form = new FormData();
          form.append("file", photoFile);
          const upRes = await fetch(`/api/products/${data.product.id}/image`, { method: "POST", body: form });
          const upData = await upRes.json();
          if (upRes.ok && upData.url) {
            product.imageUrl = upData.url;
            setImageUrl(upData.url);
          }
        } catch { /* non-fatal */ }
      }

      onSaved(product);
      toast({ title: `"${name}" criado!` });
      onClose();
    } catch (err) {
      toast({ title: "Erro", description: String(err), variant: "destructive" });
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
      <div className="bg-surface-900 border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Package className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Novo produto</h2>
              <p className="text-[10px] text-muted-foreground">Passo {step} de 2</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* ── STEP 1: Identificação ──────────────────────── */}
          {step === 1 && (
            <>
              <p className="text-xs text-muted-foreground">
                Digite o nome ou tire uma foto — a IA preenche categoria e descrição.
              </p>

              {/* Photo */}
              <div className="flex items-center gap-3">
                {photoPreview ? (
                  <div className="relative h-20 w-20 rounded-xl overflow-hidden border border-border shrink-0">
                    <Image src={photoPreview} alt="foto" fill className="object-cover" />
                    <button
                      onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/70 flex items-center justify-center"
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="h-20 w-20 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 hover:border-primary/40 transition-colors shrink-0"
                  >
                    <Camera className="h-5 w-5 text-muted-foreground" />
                    <span className="text-[9px] text-muted-foreground">Foto</span>
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhoto(f); e.target.value = ""; }}
                />
                <div className="flex-1 space-y-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Nome *</label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Shampoo Kérastase..." autoFocus />
                  </div>
                </div>
              </div>

              {/* AI analyze button */}
              {(name.trim() || photoPreview) && !analyzed && (
                <Button
                  onClick={analyzeProduct}
                  disabled={analyzing}
                  className="w-full text-xs gap-2 bg-purple-600 hover:bg-purple-500 text-white"
                >
                  {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {analyzing ? "Analisando..." : "Analisar com IA"}
                </Button>
              )}

              {/* Category & description (editable, auto-filled by AI) */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Categoria</label>
                <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex: Cabelo, Skincare..." />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Descrição</label>
                <Input value={description} onChange={(e) => setDesc(e.target.value)} placeholder="Descrição curta do produto..." />
              </div>
            </>
          )}

          {/* ── STEP 2: Preço ─────────────────────────────── */}
          {step === 2 && (
            <>
              <p className="text-xs text-muted-foreground">
                Defina o preço ou peça uma sugestão baseada no mercado.
              </p>

              {/* Price input */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Preço *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                  <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" className="pl-9 text-lg font-bold" inputMode="decimal" />
                </div>
              </div>

              {/* AI price suggestion */}
              <Button
                onClick={suggestPrice}
                disabled={suggestLoading || !name.trim()}
                className="w-full text-xs gap-2 bg-purple-600 hover:bg-purple-500 text-white"
              >
                {suggestLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TrendingUp className="h-3.5 w-3.5" />}
                {suggestLoading ? "Buscando preço..." : "Buscar preço médio com IA"}
              </Button>

              {suggestion && (
                <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-purple-400 font-medium uppercase tracking-wide">Faixa de mercado</span>
                    <Sparkles className="h-3 w-3 text-purple-400" />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-center flex-1">
                      <p className="text-[10px] text-muted-foreground">Mínimo</p>
                      <p className="text-sm font-bold text-foreground">R$ {suggestion.minPrice.toFixed(2).replace(".", ",")}</p>
                    </div>
                    <div className="text-center flex-1 border-x border-purple-500/20 px-3">
                      <p className="text-[10px] text-purple-400">Sugerido</p>
                      <p className="text-sm font-bold text-purple-400">R$ {suggestion.suggestedPrice.toFixed(2).replace(".", ",")}</p>
                    </div>
                    <div className="text-center flex-1">
                      <p className="text-[10px] text-muted-foreground">Máximo</p>
                      <p className="text-sm font-bold text-foreground">R$ {suggestion.maxPrice.toFixed(2).replace(".", ",")}</p>
                    </div>
                  </div>
                  {/* Quick select buttons */}
                  <div className="flex gap-1.5 pt-1">
                    {[suggestion.minPrice, suggestion.suggestedPrice, suggestion.maxPrice].map((v, i) => (
                      <button
                        key={i}
                        onClick={() => setPrice(String(v).replace(".", ","))}
                        className="flex-1 text-[10px] py-1 rounded border border-border hover:border-purple-500/40 hover:bg-purple-500/10 text-foreground transition-colors"
                      >
                        R$ {v.toFixed(2).replace(".", ",")}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">{suggestion.note}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-border">
          {step === 1 ? (
            <>
              <Button variant="ghost" onClick={onClose} className="flex-1 text-xs">Cancelar</Button>
              <Button
                onClick={() => setStep(2)}
                disabled={!name.trim()}
                className="flex-1 text-xs gap-1 bg-gold-500 hover:bg-gold-400 text-black"
              >
                Próximo <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setStep(1)} className="text-xs gap-1">
                <ChevronLeft className="h-3.5 w-3.5" /> Voltar
              </Button>
              <div className="flex-1" />
              <Button
                onClick={handleCreate}
                disabled={saving || !name.trim() || !price}
                className="text-xs gap-1 bg-gold-500 hover:bg-gold-400 text-black"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {saving ? "Criando..." : "Criar produto"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Product Modal (edit only) ─────────────────────────────────

function ProductModal({
  product,
  onClose,
  onSaved,
}: {
  product?: Product;
  onClose: () => void;
  onSaved: (p: Product) => void;
}) {
  const [name, setName]               = useState(product?.name ?? "");
  const [price, setPrice]             = useState(product ? String(product.price).replace(".", ",") : "");
  const [category, setCategory]       = useState(product?.category ?? "");
  const [description, setDesc]        = useState(product?.description ?? "");
  const [imageUrl, setImageUrl]       = useState<string | null>(product?.imageUrl ?? null);
  const [saving, setSaving]           = useState(false);
  const [createdId, setCreatedId]     = useState<string | null>(product?.id ?? null);
  const [justCreated, setJustCreated] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [priceSuggestion, setPriceSuggestion] = useState<{ minPrice: number; maxPrice: number; suggestedPrice: number; note: string } | null>(null);
  const isEdit = !!product;

  async function handleSave() {
    if (!name.trim()) { toast({ title: "Nome é obrigatório", variant: "destructive" }); return; }
    const priceNum = parseFloat(price.replace(",", "."));
    if (isNaN(priceNum) || priceNum < 0) { toast({ title: "Preço inválido", variant: "destructive" }); return; }

    setSaving(true);
    try {
      const url    = isEdit ? `/api/products/${product.id}` : "/api/products";
      const method = isEdit ? "PATCH" : "POST";
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          price: priceNum,
          category: category.trim() || undefined,
          description: description.trim() || undefined,
          imageUrl: imageUrl ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar");
      const savedProduct = { ...data.product, imageUrl: imageUrl ?? data.product.imageUrl ?? null };
      onSaved(savedProduct);
      if (isEdit) {
        toast({ title: "Produto atualizado!" });
        onClose();
      } else {
        setCreatedId(data.product.id);
        setJustCreated(true);
        toast({ title: "Produto criado! Adicione uma foto se quiser." });
      }
    } catch (err) {
      toast({ title: "Erro", description: String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
      <div className="bg-surface-900 border border-border rounded-2xl w-full max-w-md space-y-4 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Package className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-base font-semibold text-foreground">
              {isEdit ? "Editar produto" : "Novo produto"}
            </h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Nome *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Pão francês, Shampoo..." autoFocus />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Preço *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
              <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" className="pl-9" inputMode="decimal" />
            </div>
            {isEdit && (
              <button
                onClick={async () => {
                  if (!name.trim()) return;
                  setSuggestLoading(true);
                  try {
                    const res = await fetch("/api/products/suggest-price", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name, category, description }),
                    });
                    const data = await res.json();
                    if (isAiLimitError(res.status, data)) { triggerAiLimitModal(); return; }
                    if (!data.error) setPriceSuggestion(data);
                  } catch {} finally { setSuggestLoading(false); }
                }}
                disabled={suggestLoading || !name.trim()}
                className="flex items-center gap-1.5 text-[11px] text-purple-400 hover:text-purple-300 transition-colors"
              >
                {suggestLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Revisar preço com IA
              </button>
            )}
            {priceSuggestion && (
              <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-2.5 space-y-1.5">
                <div className="flex gap-2 text-[10px]">
                  <span className="text-muted-foreground">Min: <strong className="text-foreground">R$ {priceSuggestion.minPrice.toFixed(2).replace(".", ",")}</strong></span>
                  <span className="text-purple-400">Sugerido: <strong>R$ {priceSuggestion.suggestedPrice.toFixed(2).replace(".", ",")}</strong></span>
                  <span className="text-muted-foreground">Max: <strong className="text-foreground">R$ {priceSuggestion.maxPrice.toFixed(2).replace(".", ",")}</strong></span>
                </div>
                <button
                  onClick={() => setPrice(String(priceSuggestion.suggestedPrice).replace(".", ","))}
                  className="text-[10px] text-purple-400 hover:text-purple-300 underline"
                >
                  Usar preço sugerido
                </button>
              </div>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Categoria (opcional)</label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex: Pães, Bebidas, Shampoo..." />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Descrição (opcional)</label>
            <Input value={description} onChange={(e) => setDesc(e.target.value)} placeholder="Detalhes do produto..." />
          </div>

          {/* Image upload */}
          {createdId ? (
            <ProductImageUpload
              productId={createdId}
              currentUrl={imageUrl}
              onUploaded={(url) => setImageUrl(url)}
            />
          ) : null}
        </div>

        <div className="flex gap-3 pt-1">
          {justCreated ? (
            <Button onClick={onClose} className="flex-1 bg-gold-500 hover:bg-gold-400 text-black">
              Concluir
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose} className="flex-1" disabled={saving}>Cancelar</Button>
              <Button onClick={handleSave} className="flex-1 bg-gold-500 hover:bg-gold-400 text-black" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (isEdit ? "Salvar" : "Criar")}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────

export function ProdutosClient({ initialProducts, shopSlug }: { initialProducts: Product[]; shopSlug?: string | null }) {
  const [products, setProducts]   = useState<Product[]>(initialProducts);
  const [search, setSearch]       = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Product | undefined>();
  const [toggling, setToggling]   = useState<string | null>(null);
  const [deleting, setDeleting]   = useState<string | null>(null);

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
      setProducts((prev) => prev.map((x) => x.id === p.id ? { ...data.product, imageUrl: p.imageUrl } : x));
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

  const [tipDismissed, setTipDismissed] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("voltaki_products_tip") === "1";
    return false;
  });

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
      {/* Guidance tip */}
      {!tipDismissed && (
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3 flex items-start gap-3">
          <Package className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Produtos para venda</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Cadastre aqui itens que você <strong>vende</strong> para seus clientes (shampoo, cremes, acessórios, etc.).
              Você pode registrar uma venda junto com um serviço prestado ou em uma visita avulsa.
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Para serviços que você <strong>realiza</strong> (corte, barba, coloração, etc.), use a seção <strong>Serviços</strong> — é lá que aparecem na agenda.
            </p>
          </div>
          <button
            onClick={() => { setTipDismissed(true); localStorage.setItem("voltaki_products_tip", "1"); }}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Public catalog link */}
      {shopSlug && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-900 px-3 py-2">
          <span className="text-xs text-muted-foreground shrink-0">Catálogo público:</span>
          <a
            href={`/loja/${shopSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline truncate"
          >
            voltaki.com/loja/{shopSlug}
          </a>
          <button
            onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/loja/${shopSlug}`); }}
            className="text-[10px] text-muted-foreground hover:text-foreground shrink-0 px-1.5 py-0.5 rounded border border-border hover:bg-surface-800 transition-colors"
          >
            Copiar
          </button>
        </div>
      )}

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
                {/* Thumbnail or letter avatar */}
                <div className="h-10 w-10 rounded-lg overflow-hidden border border-border flex items-center justify-center shrink-0 bg-surface-800">
                  {p.imageUrl ? (
                    <Image src={p.imageUrl} alt={p.name} width={40} height={40} className="object-cover w-full h-full" />
                  ) : (
                    <span className="text-sm font-semibold text-foreground">{p.name.charAt(0).toUpperCase()}</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                    {p.imageUrl && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary shrink-0">📸</span>
                    )}
                  </div>
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

      {showModal && editing && (
        <ProductModal
          product={editing}
          onClose={() => { setShowModal(false); setEditing(undefined); }}
          onSaved={handleSaved}
        />
      )}
      {showModal && !editing && (
        <NewProductWizard
          onClose={() => { setShowModal(false); setEditing(undefined); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
