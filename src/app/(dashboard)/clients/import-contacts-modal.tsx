"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Smartphone, Upload, Check, X, UserPlus } from "lucide-react";

interface ContactPreview {
  name: string;
  phone: string | null;
  email: string | null;
  selected: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: (count: number) => void;
}

// Detect Contact Picker API support
const supportsContacts =
  typeof navigator !== "undefined" &&
  "contacts" in navigator &&
  "ContactsManager" in window;

function parseCSV(text: string): ContactPreview[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];

  // Detect if first row is header
  const first = lines[0].toLowerCase();
  const hasHeader = first.includes("nome") || first.includes("name") || first.includes("telefone") || first.includes("phone");
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines
    .map((line) => {
      // Handle quoted CSV values
      const cols = line.split(/,|;/).map((v) => v.trim().replace(/^"|"$/g, ""));
      const name  = cols[0] ?? "";
      const phone = cols[1] || null;
      const email = cols[2] || null;
      return { name, phone, email, selected: true };
    })
    .filter((c) => c.name.length > 0);
}

export function ImportContactsModal({ open, onClose, onImported }: Props) {
  const [step, setStep]           = useState<"choose" | "preview">("choose");
  const [contacts, setContacts]   = useState<ContactPreview[]>([]);
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<{ imported: number; skipped: number } | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const fileRef                   = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("choose");
    setContacts([]);
    setLoading(false);
    setResult(null);
    setError(null);
  }

  function close() {
    reset();
    onClose();
  }

  async function pickFromPhone() {
    if (!supportsContacts) return;
    setLoading(true);
    setError(null);
    try {
      const props = ["name", "tel", "email"];
      const contactsApi = (navigator as unknown as { contacts: { select: (p: string[], o: object) => Promise<unknown[]> } }).contacts;
      const selected: unknown[] = await contactsApi.select(props, { multiple: true });
      if (!selected || selected.length === 0) { setLoading(false); return; }

      const parsed: ContactPreview[] = selected.map((c) => {
        const contact = c as Record<string, unknown>;
        return {
          name:     Array.isArray(contact.name)  ? String(contact.name[0] ?? "")  : String(contact.name  ?? ""),
          phone:    Array.isArray(contact.tel)   ? String(contact.tel[0]  ?? "")  : contact.tel  ? String(contact.tel)  : null,
          email:    Array.isArray(contact.email) ? String(contact.email[0] ?? "") : contact.email ? String(contact.email) : null,
          selected: true,
        };
      }).filter((c) => c.name.length > 0);

      setContacts(parsed);
      setStep("preview");
    } catch {
      setError("Não foi possível acessar os contatos.");
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length === 0) {
        setError("Nenhum contato encontrado no arquivo. Verifique o formato.");
        return;
      }
      setError(null);
      setContacts(parsed);
      setStep("preview");
    };
    reader.readAsText(file, "UTF-8");
    // Reset so same file can be re-uploaded
    e.target.value = "";
  }

  function toggleAll(val: boolean) {
    setContacts((prev) => prev.map((c) => ({ ...c, selected: val })));
  }

  function toggleOne(idx: number) {
    setContacts((prev) => prev.map((c, i) => i === idx ? { ...c, selected: !c.selected } : c));
  }

  async function doImport() {
    const toSend = contacts.filter((c) => c.selected);
    if (toSend.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/customers/import", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ contacts: toSend }),
      });
      if (!res.ok) throw new Error("Erro ao importar");
      const data = await res.json();
      setResult(data);
      onImported(data.imported);
    } catch {
      setError("Erro ao importar contatos. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  const selectedCount = contacts.filter((c) => c.selected).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />
      <div className="relative z-10 w-full sm:max-w-lg bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-gold-400" />
            <h2 className="font-semibold text-foreground">
              {step === "choose" ? "Importar Clientes" : `${contacts.length} contatos encontrados`}
            </h2>
          </div>
          <button onClick={close} className="rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-700 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* Step: choose source */}
          {step === "choose" && !result && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Escolha como importar seus clientes:</p>

              {supportsContacts && (
                <button
                  onClick={pickFromPhone}
                  disabled={loading}
                  className="w-full flex items-center gap-4 rounded-xl border border-border bg-surface-800 hover:border-gold-500/40 hover:bg-surface-700 px-4 py-4 text-left transition-colors group"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-500/10 border border-gold-500/20 group-hover:bg-gold-500/20 shrink-0">
                    {loading ? <Loader2 className="h-5 w-5 animate-spin text-gold-400" /> : <Smartphone className="h-5 w-5 text-gold-400" />}
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-sm">Agenda do celular</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Selecione contatos direto do seu dispositivo</p>
                  </div>
                </button>
              )}

              <button
                onClick={() => fileRef.current?.click()}
                disabled={loading}
                className="w-full flex items-center gap-4 rounded-xl border border-border bg-surface-800 hover:border-gold-500/40 hover:bg-surface-700 px-4 py-4 text-left transition-colors group"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-500/10 border border-gold-500/20 group-hover:bg-gold-500/20 shrink-0">
                  <Upload className="h-5 w-5 text-gold-400" />
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">Importar CSV</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Arquivo com colunas: nome, telefone, email</p>
                </div>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={handleFileChange}
              />

              <div className="rounded-lg bg-surface-800/50 border border-border px-4 py-3 mt-2">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Formato CSV:</strong> uma linha por cliente.<br />
                  Colunas: <code className="text-gold-400">nome, telefone, email</code> (email opcional).<br />
                  Ex: <code className="text-muted-foreground/70">João Silva, 11999990000, joao@email.com</code>
                </p>
              </div>
            </div>
          )}

          {/* Step: preview + select */}
          {step === "preview" && !result && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{selectedCount} de {contacts.length} selecionados</p>
                <div className="flex gap-2">
                  <button onClick={() => toggleAll(true)}  className="text-xs text-gold-400 hover:text-gold-300">Todos</button>
                  <span className="text-muted-foreground text-xs">·</span>
                  <button onClick={() => toggleAll(false)} className="text-xs text-muted-foreground hover:text-foreground">Nenhum</button>
                </div>
              </div>

              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {contacts.map((c, i) => (
                  <label
                    key={i}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                      c.selected ? "border-gold-500/30 bg-gold-500/5" : "border-border bg-surface-800/40"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={c.selected}
                      onChange={() => toggleOne(i)}
                      className="accent-yellow-500 w-4 h-4 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[c.phone, c.email].filter(Boolean).join(" · ") || "Sem telefone"}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15 border border-green-500/30">
                <Check className="h-7 w-7 text-green-400" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground text-lg">{result.imported} clientes importados</p>
                {result.skipped > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {result.skipped} ignorados (já existem ou sem nome)
                  </p>
                )}
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive mt-3">{error}</p>
          )}
        </div>

        {/* Footer */}
        {!result && (
          <div className="flex items-center gap-3 px-5 py-4 border-t border-border shrink-0">
            {step === "preview" && (
              <Button variant="outline" size="sm" onClick={() => { setStep("choose"); setContacts([]); }} disabled={loading} className="flex-1">
                Voltar
              </Button>
            )}
            {step === "choose" && (
              <Button variant="outline" size="sm" onClick={close} className="flex-1">
                Cancelar
              </Button>
            )}
            {step === "preview" && (
              <Button
                size="sm"
                onClick={doImport}
                disabled={loading || selectedCount === 0}
                className="flex-1 bg-gold-500 hover:bg-gold-400 text-black"
              >
                {loading
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Importando...</>
                  : `Importar ${selectedCount} cliente${selectedCount !== 1 ? "s" : ""}`}
              </Button>
            )}
          </div>
        )}
        {result && (
          <div className="px-5 py-4 border-t border-border shrink-0">
            <Button size="sm" onClick={close} className="w-full bg-gold-500 hover:bg-gold-400 text-black">
              Concluir
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
