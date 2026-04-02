"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus, UserPen } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export interface CustomerRow {
  id:           string;
  name:         string;
  phone:        string | null;
  email:        string | null;
  notes:        string | null;
  doNotContact: boolean;
  tags:         string[];
}

interface Props {
  mode:     "create" | "edit";
  customer: CustomerRow | null;   // null when mode=create
  open:     boolean;
  onClose:  () => void;
  onSaved:  (customer: CustomerRow) => void;
}

export function CustomerDrawer({ mode, customer, open, onClose, onSaved }: Props) {
  const [name,         setName]         = useState("");
  const [phone,        setPhone]        = useState("");
  const [email,        setEmail]        = useState("");
  const [notes,        setNotes]        = useState("");
  const [doNotContact, setDoNotContact] = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  // Sync form when customer changes
  useEffect(() => {
    if (customer) {
      setName(customer.name);
      setPhone(customer.phone ?? "");
      setEmail(customer.email ?? "");
      setNotes(customer.notes ?? "");
      setDoNotContact(customer.doNotContact);
    } else {
      setName(""); setPhone(""); setEmail(""); setNotes(""); setDoNotContact(false);
    }
    setError(null);
  }, [customer, open]);

  async function handleSave() {
    if (!name.trim()) { setError("Nome é obrigatório."); return; }
    setSaving(true); setError(null);
    try {
      const body = { name: name.trim(), phone: phone.trim() || null, email: email.trim() || null, notes: notes.trim() || null, doNotContact };

      let res: Response;
      if (mode === "create") {
        res = await fetch("/api/customers", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
      } else {
        res = await fetch(`/api/customers/${customer!.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar");
      toast({ title: mode === "create" ? "Cliente criado!" : "Cliente atualizado!" });
      onSaved(data.customer);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {mode === "create"
              ? <><UserPlus className="h-4 w-4 text-gold-400" /> Novo cliente</>
              : <><UserPen className="h-4 w-4 text-gold-400" /> Editar cliente</>
            }
          </SheetTitle>
          {mode === "edit" && customer && (
            <SheetDescription>Editando dados de {customer.name}</SheetDescription>
          )}
        </SheetHeader>

        <div className="px-6 pb-6 mt-4 space-y-4">
          <Field label="Nome *" value={name} onChange={setName} placeholder="Nome completo" />
          <Field label="Telefone" value={phone} onChange={setPhone} placeholder="(11) 99999-0000" type="tel" />
          <Field label="E-mail" value={email} onChange={setEmail} placeholder="email@exemplo.com" type="email" />
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Observações</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Preferências, alergias, informações importantes…"
              className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={doNotContact}
              onChange={(e) => setDoNotContact(e.target.checked)}
              className="rounded border-border"
            />
            <span className="text-xs text-foreground">Não contactar (pós-venda desativado)</span>
          </label>

          {error && (
            <p className="text-sm text-red-400 rounded-md border border-red-500/30 bg-red-500/8 px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "create" ? "Criar cliente" : "Salvar alterações"}
            </Button>
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  );
}
