"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  Building2, RefreshCw, Save, Pencil, MapPin, Phone, Globe,
  Share2, Camera, X, Instagram, Download, Sparkles,
} from "lucide-react";

export interface BarbershopData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  websiteUrl: string | null;
  description: string | null;
  slug: string;
  logoUrl: string | null;
  instagramUrl: string | null;
  brandStyle: string | null;
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function buildQrUrl(url: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=4&data=${encodeURIComponent(url)}`;
}

// ── View mode: shareable card ─────────────────────────────────────────────────
function CardView({ data, onEdit }: { data: BarbershopData; onEdit: () => void }) {
  const location = [data.address, data.city, data.state].filter(Boolean).join(", ");
  const cardRef  = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);

  async function handleShare() {
    if (!cardRef.current) return;
    setSharing(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: "#0f0f0f",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `${data.slug}-cartao.png`, { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          try { await navigator.share({ files: [file], title: data.name }); } catch { /* cancelled */ }
        } else {
          // Fallback: download the image
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = file.name;
          a.click();
          URL.revokeObjectURL(url);
          toast({ title: "Imagem baixada!", description: "Cartão salvo como imagem." });
        }
      }, "image/png");
    } catch {
      toast({ title: "Erro ao gerar imagem", variant: "destructive" });
    } finally {
      setSharing(false);
    }
  }

  const igUrl = data.instagramUrl?.startsWith("http")
    ? data.instagramUrl
    : data.instagramUrl
      ? `https://instagram.com/${data.instagramUrl.replace(/^@/, "")}`
      : null;

  return (
    <div className="rounded-2xl border border-gold-500/20 bg-gradient-to-br from-surface-900 via-surface-900 to-surface-800 overflow-hidden shadow-lg">
      {/* Gold accent bar */}
      <div className="h-1 bg-gradient-to-r from-gold-600 via-gold-400 to-gold-600" />

      {/* Capturable card area */}
      <div ref={cardRef} className="p-6 bg-gradient-to-br from-surface-900 via-surface-900 to-surface-800">
        <div className="flex items-start gap-4">
          {/* Logo */}
          <div className="shrink-0">
            {data.logoUrl ? (
              <img
                src={data.logoUrl}
                alt={data.name}
                className="h-20 w-20 rounded-xl object-cover border-2 border-gold-500/30 shadow"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="h-20 w-20 rounded-xl bg-gold-500/15 border-2 border-gold-500/30 flex items-center justify-center">
                <span className="text-2xl font-bold text-gold-400">{getInitials(data.name)}</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-foreground truncate">{data.name}</h2>
            {data.description && (
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{data.description}</p>
            )}

            <div className="mt-3 space-y-1.5">
              {location && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 text-gold-400/70 shrink-0" />
                  <span className="truncate">{location}</span>
                </div>
              )}
              {data.phone && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 text-gold-400/70 shrink-0" />
                  <span>{data.phone}</span>
                </div>
              )}
              {data.websiteUrl && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Globe className="h-3.5 w-3.5 text-gold-400/70 shrink-0" />
                  <a
                    href={data.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate hover:text-gold-400 transition-colors"
                  >
                    {data.websiteUrl.replace(/^https?:\/\//, "")}
                  </a>
                </div>
              )}
              {igUrl && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Instagram className="h-3.5 w-3.5 text-gold-400/70 shrink-0" />
                  <a
                    href={igUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate hover:text-gold-400 transition-colors"
                  >
                    {data.instagramUrl?.startsWith("http")
                      ? data.instagramUrl.replace(/^https?:\/\/(www\.)?instagram\.com\//, "@").replace(/\/$/, "")
                      : data.instagramUrl}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* QR code for Instagram */}
          {igUrl && (
            <div className="shrink-0 flex flex-col items-center gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={buildQrUrl(igUrl)}
                alt="QR Instagram"
                className="h-[72px] w-[72px] rounded-lg bg-white p-1"
                crossOrigin="anonymous"
              />
              <span className="text-[9px] text-muted-foreground">Instagram</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-5 pt-4 border-t border-border/40 flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground/50">glaucobarber.com/{data.slug}</p>
        </div>
      </div>

      {/* Action buttons outside the capturable area */}
      <div className="px-6 pb-4 flex gap-2 justify-end">
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={handleShare} disabled={sharing}>
          {sharing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <><Share2 className="h-3.5 w-3.5" /><Download className="h-3 w-3 -ml-1" /></>}
          {sharing ? "Gerando..." : "Compartilhar"}
        </Button>
        <Button size="sm" className="h-8 text-xs gap-1.5" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" /> Editar
        </Button>
      </div>
    </div>
  );
}

// ── Edit form ─────────────────────────────────────────────────────────────────
export function BarbershopCard({ barbershop }: { barbershop: BarbershopData }) {
  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [values, setValues]     = useState({ ...barbershop });
  const [snapshot, setSnapshot] = useState({ ...barbershop });
  const [logoPreview, setLogoPreview] = useState<string | null>(barbershop.logoUrl);
  const [improvingStyle, setImprovingStyle] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function onChange(field: keyof BarbershopData, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function reset() {
    setValues(snapshot);
    setLogoPreview(snapshot.logoUrl);
    setEditing(false);
    setError("");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      toast({ title: "Imagem muito grande", description: "Máximo 500 KB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setLogoPreview(dataUrl);
      setValues((prev) => ({ ...prev, logoUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
  }

  async function handleImproveStyle() {
    const raw = values.brandStyle?.trim();
    if (!raw) {
      toast({ title: "Escreva algo primeiro", description: "Descreva brevemente o estilo da sua marca.", variant: "destructive" });
      return;
    }
    setImprovingStyle(true);
    try {
      const res = await fetch("/api/settings/brand-style/improve", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ rawStyle: raw }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Erro", description: data.message ?? "Não foi possível melhorar a descrição.", variant: "destructive" });
        return;
      }
      setValues((p) => ({ ...p, brandStyle: data.brandStyle }));
      toast({ title: "Estilo melhorado!", description: "A IA expandiu sua descrição visual." });
    } catch {
      toast({ title: "Erro de conexão", variant: "destructive" });
    } finally {
      setImprovingStyle(false);
    }
  }

  async function onSave() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/barbershop", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erro ao salvar"); return; }
      setSnapshot(data.barbershop);
      setValues(data.barbershop);
      setLogoPreview(data.barbershop.logoUrl);
      setEditing(false);
      toast({ title: "Dados atualizados", description: "Informações salvas com sucesso." });
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return <CardView data={{ ...values, logoUrl: logoPreview }} onEdit={() => setEditing(true)} />;
  }

  return (
    <div className="rounded-2xl border border-gold-500/20 bg-surface-900 overflow-hidden shadow-lg">
      <div className="h-1 bg-gradient-to-r from-gold-600 via-gold-400 to-gold-600" />
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="h-4 w-4 text-gold-400" />
          <h3 className="text-base font-semibold">Editar dados da barbearia</h3>
        </div>

        {/* Logo upload */}
        <div className="flex items-center gap-4">
          <div className="shrink-0 relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
            {logoPreview ? (
              <img src={logoPreview} alt="Logo" className="h-20 w-20 rounded-xl object-cover border-2 border-gold-500/30" />
            ) : (
              <div className="h-20 w-20 rounded-xl bg-gold-500/15 border-2 border-gold-500/30 flex items-center justify-center">
                <span className="text-2xl font-bold text-gold-400">{getInitials(values.name || "?")}</span>
              </div>
            )}
            <div className="absolute inset-0 rounded-xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="h-6 w-6 text-white" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-foreground">Logo da barbearia</p>
            <p className="text-[11px] text-muted-foreground">Clique na imagem ou use uma URL. Máx 500 KB.</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => fileRef.current?.click()}>
                <Camera className="h-3 w-3" /> Upload
              </Button>
              {logoPreview && (
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => { setLogoPreview(null); setValues((p) => ({ ...p, logoUrl: null as unknown as string })); }}>
                  <X className="h-3 w-3" /> Remover
                </Button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            <input
              type="url"
              placeholder="Ou cole uma URL..."
              value={values.logoUrl?.startsWith("data:") ? "" : (values.logoUrl ?? "")}
              onChange={(e) => { setValues((p) => ({ ...p, logoUrl: e.target.value })); setLogoPreview(e.target.value || null); }}
              className="w-full rounded-md border border-border bg-surface-800 px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        {/* Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <Field label="Nome *"    value={values.name}           onChange={(v) => onChange("name", v)} />
          <Field label="Slug *"    value={values.slug}           onChange={(v) => onChange("slug", v)} helper="letras e números, sem espaços" />
          <Field label="Email"     value={values.email ?? ""}    onChange={(v) => onChange("email", v)} />
          <Field label="Telefone"  value={values.phone ?? ""}    onChange={(v) => onChange("phone", v)} />
          <Field label="Cidade"    value={values.city ?? ""}     onChange={(v) => onChange("city", v)} />
          <Field label="Estado"    value={values.state ?? ""}    onChange={(v) => onChange("state", v)} />
          <Field label="Endereço"  value={values.address ?? ""}  onChange={(v) => onChange("address", v)} />
          <Field label="Site"      value={values.websiteUrl ?? ""} onChange={(v) => onChange("websiteUrl", v)} />
          <Field
            label="Instagram"
            value={values.instagramUrl ?? ""}
            onChange={(v) => onChange("instagramUrl", v)}
            helper="ex: @suabarbearia"
            placeholder="@suabarbearia ou URL"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Descrição</label>
          <textarea
            className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            value={values.description ?? ""}
            onChange={(e) => onChange("description", e.target.value)}
            rows={3}
            placeholder="Descreva sua barbearia..."
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-xs text-muted-foreground">Estilo visual da marca</label>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">Usado na geração de imagens de campanhas. Descreva cores, mood e elementos visuais.</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px] gap-1 border-gold-500/30 text-gold-400 hover:bg-gold-500/10 shrink-0 ml-2"
              onClick={handleImproveStyle}
              disabled={improvingStyle || saving}
            >
              {improvingStyle ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {improvingStyle ? "Melhorando..." : "Melhorar com IA"}
            </Button>
          </div>
          <textarea
            className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            value={values.brandStyle ?? ""}
            onChange={(e) => setValues((p) => ({ ...p, brandStyle: e.target.value.slice(0, 300) }))}
            rows={2}
            maxLength={300}
            placeholder="ex: fundo preto, detalhes dourados, premium masculino, cinematográfico, navalha dourada como símbolo"
          />
          <p className="text-[10px] text-muted-foreground/50 text-right">{(values.brandStyle?.length ?? 0)}/300</p>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex flex-wrap gap-2 justify-end pt-1">
          <Button variant="ghost" size="sm" className="text-xs" onClick={reset} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" className="text-xs gap-1" onClick={onSave} disabled={saving || !values.name || !values.slug}>
            {saving ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, helper, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; helper?: string; placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs text-muted-foreground">{label}</label>
        {helper && <span className="text-[10px] text-muted-foreground/70">{helper}</span>}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}
