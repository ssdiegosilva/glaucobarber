"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

type Log  = { id: string; action: string; entity: string; metadata: string; createdAt: string; barbershopName: string | null; userName: string | null };
type Shop = { id: string; name: string };

export function LogsClient({ logs, total, shops }: { logs: Log[]; total: number; shops: Shop[] }) {
  const [q, setQ] = useState("");

  const filtered = logs.filter((l) =>
    !q ||
    l.action.toLowerCase().includes(q.toLowerCase()) ||
    (l.barbershopName ?? "").toLowerCase().includes(q.toLowerCase()) ||
    (l.userName ?? "").toLowerCase().includes(q.toLowerCase())
  );

  function metaPreview(raw: string) {
    try {
      const obj = JSON.parse(raw);
      return Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join(" · ");
    } catch {
      return raw;
    }
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">{total} eventos registrados · exibindo últimos 50</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar por ação, barbearia ou usuário…" className="pl-9" />
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-800 border-b border-border">
            <tr>
              {["Data", "Ação", "Entidade", "Barbearia", "Usuário", "Metadata"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((l) => (
              <tr key={l.id} className="hover:bg-surface-800/40">
                <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(l.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-4 py-2.5">
                  <code className="text-xs bg-surface-700 rounded px-1.5 py-0.5 text-gold-400">{l.action}</code>
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{l.entity || "—"}</td>
                <td className="px-4 py-2.5 text-xs text-foreground">{l.barbershopName ?? "—"}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{l.userName ?? "—"}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-xs truncate">
                  {l.metadata ? metaPreview(l.metadata) : "—"}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">Nenhum log encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
