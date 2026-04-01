"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Building2, RefreshCw, Save } from "lucide-react";

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
}

export function BarbershopCard({ barbershop }: { barbershop: BarbershopData }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [values, setValues] = useState({ ...barbershop });
  const [snapshot, setSnapshot] = useState({ ...barbershop });

  function onChange(field: keyof BarbershopData, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function reset() {
    setValues(snapshot);
    setEditing(false);
    setError("");
  }

  async function onSave() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/barbershop", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao salvar");
        return;
      }
      setSnapshot(data.barbershop);
      setValues(data.barbershop);
      setEditing(false);
      toast({ title: "Dados atualizados", description: "Informações salvas com sucesso." });
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <Building2 className="h-4 w-4 text-gold-400" />
        <CardTitle className="text-base">Dados da Barbearia</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Nome" value={values.name} onChange={(v) => onChange("name", v)} editing={editing} required />
          <Field label="Slug" value={values.slug} onChange={(v) => onChange("slug", v)} editing={editing} required helper="usado em links, só letras/números" />
          <Field label="Email" value={values.email ?? ""} onChange={(v) => onChange("email", v)} editing={editing} />
          <Field label="Telefone" value={values.phone ?? ""} onChange={(v) => onChange("phone", v)} editing={editing} />
          <Field label="Cidade" value={values.city ?? ""} onChange={(v) => onChange("city", v)} editing={editing} />
          <Field label="Estado" value={values.state ?? ""} onChange={(v) => onChange("state", v)} editing={editing} />
          <Field label="Endereço" value={values.address ?? ""} onChange={(v) => onChange("address", v)} editing={editing} />
          <Field label="Site" value={values.websiteUrl ?? ""} onChange={(v) => onChange("websiteUrl", v)} editing={editing} />
          <Field label="Logo (URL)" value={values.logoUrl ?? ""} onChange={(v) => onChange("logoUrl", v)} editing={editing} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Descrição</label>
          {editing ? (
            <textarea
              className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground"
              value={values.description ?? ""}
              onChange={(e) => onChange("description", e.target.value)}
              rows={3}
            />
          ) : (
            <div className="w-full rounded-md border border-border/40 bg-surface-900 px-3 py-2 text-xs text-foreground min-h-[64px]">
              {(values.description ?? "").trim() || "—"}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex flex-wrap gap-2 justify-end pt-1">
          {editing ? (
            <>
              <Button variant="ghost" size="sm" className="text-xs" onClick={reset} disabled={saving}>
                Cancelar
              </Button>
              <Button size="sm" className="text-xs" onClick={onSave} disabled={saving || !values.name || !values.slug}>
                {saving ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setEditing(true)}>
              Editar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, value, onChange, editing, required, helper }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  editing: boolean;
  required?: boolean;
  helper?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs text-muted-foreground">{label}{required ? " *" : ""}</label>
        {helper && <span className="text-[10px] text-muted-foreground">{helper}</span>}
      </div>
      {editing ? (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      ) : (
        <div className="w-full rounded-md border border-border/40 bg-surface-900 px-3 py-2 text-xs text-foreground min-h-[38px] flex items-center">
          {value?.trim() || "—"}
        </div>
      )}
    </div>
  );
}
