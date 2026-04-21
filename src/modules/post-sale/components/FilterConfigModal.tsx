"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Loader2, Plus, Trash2, Settings2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { PostSaleFilterConfig, CustomFilter } from "../types";

const DEFAULT_KEYS = ["emRisco", "recentes", "inativos", "reativados"] as const;
const DEFAULT_LABELS: Record<string, string> = {
  emRisco: "Clientes em risco",
  recentes: "Recém-atendidos",
  inativos: "Inativos",
  reativados: "Reativados",
};

const MAX_VISIBLE = 4;

interface ServiceOption {
  id: string;
  name: string;
  followUpDays: number;
}

interface ProductOption {
  id: string;
  name: string;
}

interface Props {
  config: PostSaleFilterConfig;
  onSaved: (config: PostSaleFilterConfig) => void;
  onClose: () => void;
}

export function FilterConfigModal({ config, onSaved, onClose }: Props) {
  const [defaults, setDefaults] = useState(config.defaults);
  const [custom, setCustom] = useState<CustomFilter[]>(config.custom);
  const [visible, setVisible] = useState<string[]>(config.visible);
  const [saving, setSaving] = useState(false);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addFilterType, setAddFilterType] = useState<"service" | "product">("service");
  const [newServiceId, setNewServiceId] = useState("");
  const [newProductId, setNewProductId] = useState("");
  const [newDays, setNewDays] = useState("");

  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then((data) => {
        const withFollowUp = (data.services ?? []).filter(
          (s: { followUpDays?: number | null }) => s.followUpDays != null && s.followUpDays > 0
        );
        setServices(withFollowUp.map((s: { id: string; name: string; followUpDays: number }) => ({
          id: s.id,
          name: s.name,
          followUpDays: s.followUpDays,
        })));
        setLoadingServices(false);
      })
      .catch(() => setLoadingServices(false));

    fetch("/api/products")
      .then((r) => r.json())
      .then((data) => {
        setProducts((data.products ?? [])
          .filter((p: { active: boolean; deletedAt?: string | null }) => p.active && !p.deletedAt)
          .map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }))
        );
        setLoadingProducts(false);
      })
      .catch(() => setLoadingProducts(false));
  }, []);

  function toggleDefault(key: string) {
    setDefaults((prev) => ({ ...prev, [key]: !prev[key as keyof typeof prev] }));
  }

  function toggleCustom(id: string) {
    setCustom((prev) => prev.map((f) => f.id === id ? { ...f, enabled: !f.enabled } : f));
  }

  function deleteCustom(id: string) {
    setCustom((prev) => prev.filter((f) => f.id !== id));
    setVisible((prev) => prev.filter((v) => v !== id));
  }

  function toggleVisible(key: string) {
    setVisible((prev) => {
      if (prev.includes(key)) return prev.filter((v) => v !== key);
      if (prev.length >= MAX_VISIBLE) {
        toast({ title: `Máximo de ${MAX_VISIBLE} filtros visíveis`, variant: "destructive" });
        return prev;
      }
      return [...prev, key];
    });
  }

  function addCustomFilter() {
    if (!newServiceId) return;
    const svc = services.find((s) => s.id === newServiceId);
    if (!svc) return;
    const days = newDays ? Number(newDays) : svc.followUpDays;
    const id = `custom_${Date.now()}`;
    setCustom((prev) => [...prev, {
      id,
      type: "service" as const,
      serviceId: svc.id,
      serviceName: svc.name,
      followUpDays: days,
      enabled: true,
    }]);
    if (visible.length < MAX_VISIBLE) {
      setVisible((prev) => [...prev, id]);
    }
    setNewServiceId("");
    setNewDays("");
    setShowAddForm(false);
  }

  function addProductFilter() {
    if (!newProductId) return;
    const prod = products.find((p) => p.id === newProductId);
    if (!prod) return;
    const days = newDays ? Number(newDays) : 30;
    const id = `custom_${Date.now()}`;
    setCustom((prev) => [...prev, {
      id,
      type: "product" as const,
      productId: prod.id,
      productName: prod.name,
      followUpDays: days,
      enabled: true,
    }]);
    if (visible.length < MAX_VISIBLE) {
      setVisible((prev) => [...prev, id]);
    }
    setNewProductId("");
    setNewDays("");
    setShowAddForm(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const body: PostSaleFilterConfig = { defaults, custom, visible };
      const res = await fetch("/api/barbershop/post-sale-filters", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erro ao salvar");
      }
      onSaved(body);
      toast({ title: "Filtros salvos!" });
      onClose();
    } catch (e) {
      toast({ title: "Erro", description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const allFilters = [
    ...DEFAULT_KEYS.map((key) => ({ id: key, label: DEFAULT_LABELS[key], isDefault: true, enabled: defaults[key] })),
    ...custom.map((f) => ({
      id: f.id,
      label: f.type === "product"
        ? `${f.productName} > ${f.followUpDays}d`
        : `${(f as { serviceName: string }).serviceName} > ${f.followUpDays}d`,
      isDefault: false,
      enabled: f.enabled,
    })),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-gold-400" />
            <h2 className="font-semibold text-foreground text-sm">Configurar filtros</h2>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-surface-700 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* Default filters */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Filtros padrão</p>
            {DEFAULT_KEYS.map((key) => (
              <div key={key} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={visible.includes(key)}
                    onChange={() => toggleVisible(key)}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm text-foreground">{DEFAULT_LABELS[key]}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Custom filters */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Filtros customizados</p>
            {custom.length === 0 && !showAddForm && (
              <p className="text-xs text-muted-foreground py-2">
                Nenhum filtro customizado. Crie filtros baseados em serviços ou produtos para acompanhar seus clientes.
              </p>
            )}
            {custom.map((f) => {
              const isProduct = f.type === "product";
              const filterName = isProduct ? f.productName : (f as { serviceName: string }).serviceName;
              const subtitle = isProduct
                ? `Produto · comprou há mais de ${f.followUpDays} dias`
                : `Serviço · há mais de ${f.followUpDays} dias`;
              return (
                <div key={f.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={visible.includes(f.id)}
                      onChange={() => toggleVisible(f.id)}
                      className="w-4 h-4 accent-primary"
                    />
                    <div>
                      <p className="text-sm text-foreground">{filterName}</p>
                      <p className="text-[10px] text-muted-foreground">{subtitle}</p>
                    </div>
                  </div>
                  <button onClick={() => deleteCustom(f.id)} className="rounded p-1.5 hover:bg-red-500/10 text-muted-foreground hover:text-red-400">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}

            {/* Add form */}
            {showAddForm ? (
              <div className="rounded-lg border border-border p-3 space-y-3 bg-surface-800/50">
                {/* Type toggle */}
                <div className="flex rounded-md border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => { setAddFilterType("service"); setNewProductId(""); setNewDays(""); }}
                    className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                      addFilterType === "service" ? "bg-gold-500/20 text-gold-400 border-r border-border" : "text-muted-foreground hover:text-foreground border-r border-border"
                    }`}
                  >
                    Serviço
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAddFilterType("product"); setNewServiceId(""); setNewDays(""); }}
                    className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                      addFilterType === "product" ? "bg-gold-500/20 text-gold-400" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Produto
                  </button>
                </div>

                {addFilterType === "service" ? (
                  // Service filter form
                  loadingServices ? (
                    <div className="flex justify-center py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : services.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Nenhum serviço com prazo de retorno definido. Configure o campo &quot;Retorno (dias)&quot; em Serviços.
                    </p>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Serviço</label>
                        <select
                          value={newServiceId}
                          onChange={(e) => {
                            setNewServiceId(e.target.value);
                            const svc = services.find((s) => s.id === e.target.value);
                            if (svc) setNewDays(String(svc.followUpDays));
                          }}
                          className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          <option value="">Selecione...</option>
                          {services.map((s) => (
                            <option key={s.id} value={s.id}>{s.name} ({s.followUpDays}d)</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Dias para follow-up</label>
                        <input
                          type="number"
                          min="1"
                          value={newDays}
                          onChange={(e) => setNewDays(e.target.value)}
                          className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="text-xs flex-1 bg-gold-500 hover:bg-gold-400 text-black" onClick={addCustomFilter} disabled={!newServiceId}>
                          Adicionar
                        </Button>
                        <Button size="sm" variant="ghost" className="text-xs" onClick={() => setShowAddForm(false)}>
                          Cancelar
                        </Button>
                      </div>
                    </>
                  )
                ) : (
                  // Product filter form
                  loadingProducts ? (
                    <div className="flex justify-center py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : products.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Nenhum produto cadastrado. Cadastre produtos na página de Produtos.
                    </p>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Produto</label>
                        <select
                          value={newProductId}
                          onChange={(e) => {
                            setNewProductId(e.target.value);
                            if (!newDays) setNewDays("30");
                          }}
                          className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          <option value="">Selecione...</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Dias desde a compra</label>
                        <input
                          type="number"
                          min="1"
                          value={newDays}
                          onChange={(e) => setNewDays(e.target.value)}
                          placeholder="30"
                          className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="text-xs flex-1 bg-gold-500 hover:bg-gold-400 text-black" onClick={addProductFilter} disabled={!newProductId}>
                          Adicionar
                        </Button>
                        <Button size="sm" variant="ghost" className="text-xs" onClick={() => setShowAddForm(false)}>
                          Cancelar
                        </Button>
                      </div>
                    </>
                  )
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Novo filtro
              </button>
            )}
          </div>

          {/* Info */}
          <p className="text-[10px] text-muted-foreground">
            Selecione até {MAX_VISIBLE} filtros para exibir na página. Você pode criar quantos filtros quiser.
          </p>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-3 flex gap-2 justify-end shrink-0">
          <Button variant="ghost" size="sm" className="text-xs" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            size="sm"
            className="text-xs bg-gold-500 hover:bg-gold-400 text-black"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}
