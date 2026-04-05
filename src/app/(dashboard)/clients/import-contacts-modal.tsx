"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Smartphone, Upload, Check, X, UserPlus, ClipboardList } from "lucide-react";

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

const supportsContacts =
  typeof navigator !== "undefined" &&
  "contacts" in navigator &&
  "ContactsManager" in window;

// "João Silva 11999990000" or "11999990000 João" or "João, 11 99999-0000"
function parsePasted(text: string): ContactPreview[] {
  return text
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const phoneMatch = line.match(/[\+]?[\d][\d\s\-\(\)]{7,}/);
      if (!phoneMatch) return { name: line.trim(), phone: null, email: null, selected: true };
      const phone = phoneMatch[0].replace(/[^\d+]/g, "");
      const name  = line.replace(phoneMatch[0], "").replace(/^[\s,\-:]+|[\s,\-:]+$/g, "").trim();
      return { name: name || phone, phone: phone || null, email: null, selected: true };
    })
    .filter((c) => c.name.length > 0);
}

function parseCSV(text: string): ContactPreview[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const first = lines[0].toLowerCase();
  const hasHeader = first.includes("nome") || first.includes("name") || first.includes("telefone") || first.includes("phone");
  return (hasHeader ? lines.slice(1) : lines)
    .map((line) => {
      const cols = line.split(/,|;/).map((v) => v.trim().replace(/^"|"$/g, ""));
      return { name: cols[0] ?? "", phone: cols[1] || null, email: cols[2] || null, selected: true };
    })
    .filter((c) => c.name.length > 0);
}

type Step = "choose" | "paste" | "preview";

export function ImportContactsModal({ open, onClose, onImported }: Props) {
  const [step, setStep]         = useState<Step>("choose");
  const [pasteText, setPasteText] = useState("");
  const [contacts, setContacts] = useState<ContactPreview[]>([]);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<{ imported: number; skipped: number } | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const csvRef                  = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("choose");
    setPasteText("");
    setContacts([]);
    setLoading(false);
    setResult(null);
    setError(null);
  }

  function close() { reset(); onClose(); }

  async function pickFromPhone() {
    if (!supportsContacts) return;
    setLoading(true);
    setError(null);
    try {
      const props = ["name", "tel", "email"];
      const api = (navigator as unknown as { contacts: { select: (p: string[], o: object) => Promise<unknown[]> } }).contacts;
      const selected = await api.select(props, { multiple: true });
      if (!selected?.length) { setLoading(false); return; }
      const parsed: ContactPreview[] = (selected as Record<string, unknown>[]).map((c) => ({
        name:     Array.isArray(c.name)  ? String(c.name[0]  ?? "") : String(c.name  ?? ""),
        phone:    Array.isArray(c.tel)   ? String(c.tel[0]   ?? "") : c.tel   ? String(c.tel)   : null,
        email:    Array.isArray(c.email) ? String(c.email[0] ?? "") : c.email ? String(c.email) : null,
        selected: true,
      })).filter((c) => c.name.length > 0);
      setContacts(parsed);
      setStep("preview");
    } catch {
      setError("Não foi possível acessar os contatos.");
    } finally {
      setLoading(false);
    }
  }

  function handlePasteNext() {
    const parsed = parsePasted(pasteText);
    if (parsed.length === 0) { setError("Nenhum contato encontrado. Coloque um nome/número por linha."); return; }
    setError(null);
    setContacts(parsed);
    setStep("preview");
  }

  function handleCSVChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCSV(ev.target?.result as string);
      if (parsed.length === 0) { setError("Nenhum contato encontrado no arquivo."); return; }
      setError(null);
      setContacts(parsed);
      setStep("preview");
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  }

  function toggleAll(val: boolean) { setContacts((p) => p.map((c) => ({ ...c, selected: val }))); }
  function toggleOne(i: number)    { setContacts((p) => p.map((c, j) => j === i ? { ...c, selected: !c.selected } : c)); }

  async function doImport() {
    const toSend = contacts.filter((c) => c.selected);
    if (!toSend.length) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/customers/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts: toSend }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setResult(data);
      onImported(data.imported);
    } catch {
      setError("Erro ao importar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  const selectedCount = contacts.filter((c) => c.selected).length;

  const title =
    step === "preview" ? `${contacts.length} contatos encontrados` :
    step === "paste"   ? "Colar lista de contatos" :
    "Importar Clientes";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />
      <div className="relative z-10 w-full sm:max-w-lg bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-gold-400" />
            <h2 className="font-semibold text-foreground">{title}</h2>
          </div>
          <button onClick={close} className="rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-700 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* Choose */}
          {step === "choose" && !result && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Como deseja importar?</p>

              {/* Paste — easiest, works on any device */}
              <button
                onClick={() => { setError(null); setStep("paste"); }}
                className="w-full flex items-center gap-4 rounded-xl border border-gold-500/30 bg-gold-500/5 hover:bg-gold-500/10 px-4 py-4 text-left transition-colors group"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-500/15 border border-gold-500/30 shrink-0">
                  <ClipboardList className="h-5 w-5 text-gold-400" />
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">Colar lista <span className="text-[10px] text-gold-500 ml-1 font-normal">mais fácil</span></p>
                  <p className="text-xs text-muted-foreground mt-0.5">Digite ou cole nome + número, um por linha</p>
                </div>
              </button>

              {/* Android contact picker */}
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
                    <p className="text-xs text-muted-foreground mt-0.5">Selecione contatos direto do dispositivo (Android)</p>
                  </div>
                </button>
              )}

              {/* CSV */}
              <button
                onClick={() => csvRef.current?.click()}
                disabled={loading}
                className="w-full flex items-center gap-4 rounded-xl border border-border bg-surface-800 hover:border-gold-500/40 hover:bg-surface-700 px-4 py-4 text-left transition-colors group"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-500/10 border border-gold-500/20 group-hover:bg-gold-500/20 shrink-0">
                  <Upload className="h-5 w-5 text-gold-400" />
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">Arquivo CSV</p>
                  <p className="text-xs text-muted-foreground mt-0.5">nome, telefone, email — uma linha por cliente</p>
                </div>
              </button>
              <input ref={csvRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleCSVChange} />
            </div>
          )}

          {/* Paste step */}
          {step === "paste" && !result && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Um contato por linha. Pode ser só o número, só o nome, ou os dois juntos.
              </p>
              <textarea
                autoFocus
                value={pasteText}
                onChange={(e) => { setPasteText(e.target.value); setError(null); }}
                placeholder={"João Silva 11999990000\nMaria 21988880000\nPedro, (11) 97777-6666\n11955554444"}
                rows={9}
                className="w-full rounded-lg border border-border bg-surface-800 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring resize-none font-mono"
              />
            </div>
          )}

          {/* Preview */}
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
                  <label key={i} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${c.selected ? "border-gold-500/30 bg-gold-500/5" : "border-border bg-surface-800/40"}`}>
                    <input type="checkbox" checked={c.selected} onChange={() => toggleOne(i)} className="accent-yellow-500 w-4 h-4 shrink-0" />
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
                {result.skipped > 0 && <p className="text-sm text-muted-foreground mt-1">{result.skipped} ignorados (já existem)</p>}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive mt-3">{error}</p>}
        </div>

        {/* Footer */}
        {!result && (
          <div className="flex items-center gap-3 px-5 py-4 border-t border-border shrink-0">
            <Button variant="outline" size="sm" onClick={step === "choose" ? close : () => { setStep("choose"); setContacts([]); setError(null); }} disabled={loading} className="flex-1">
              {step === "choose" ? "Cancelar" : "Voltar"}
            </Button>

            {step === "paste" && (
              <Button size="sm" onClick={handlePasteNext} disabled={!pasteText.trim()} className="flex-1 bg-gold-500 hover:bg-gold-400 text-black">
                Continuar
              </Button>
            )}

            {step === "preview" && (
              <Button size="sm" onClick={doImport} disabled={loading || selectedCount === 0} className="flex-1 bg-gold-500 hover:bg-gold-400 text-black">
                {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Importando...</> : `Importar ${selectedCount} cliente${selectedCount !== 1 ? "s" : ""}`}
              </Button>
            )}
          </div>
        )}
        {result && (
          <div className="px-5 py-4 border-t border-border shrink-0">
            <Button size="sm" onClick={close} className="w-full bg-gold-500 hover:bg-gold-400 text-black">Concluir</Button>
          </div>
        )}
      </div>
    </div>
  );
}
