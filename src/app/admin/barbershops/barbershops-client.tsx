"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronRight, Users, Calendar, Brain, Trash2 } from "lucide-react";

type Shop = {
  id: string; name: string; slug: string; email: string; city: string;
  createdAt: string; customers: number; appointments: number; aiUsed: number;
  planTier: string; subStatus: string; trialEndsAt: string | null;
  creditBalance: number; stripeCustomerId: string | null;
};

const PLAN_COLOR: Record<string, string> = {
  FREE:       "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
  STARTER:    "border-blue-500/30 bg-blue-500/10 text-blue-400",
  PRO:        "border-gold-500/30 bg-gold-500/10 text-gold-400",
  ENTERPRISE: "border-purple-500/30 bg-purple-500/10 text-purple-400",
};

const STATUS_COLOR: Record<string, string> = {
  ACTIVE:     "border-green-500/30 bg-green-500/10 text-green-400",
  TRIALING:   "border-blue-500/30 bg-blue-500/10 text-blue-400",
  PAST_DUE:   "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
  CANCELED:   "border-red-500/30 bg-red-500/10 text-red-400",
  UNPAID:     "border-red-500/30 bg-red-500/10 text-red-400",
  INCOMPLETE: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
};

export function BarbershopsClient({ data: initialData }: { data: Shop[] }) {
  const router = useRouter();
  const [data,    setData]    = useState(initialData);
  const [q,       setQ]       = useState("");
  const [planF,   setPlanF]   = useState("ALL");
  const [statusF, setStatusF] = useState("ALL");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/barbershops/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao deletar");
      setData((prev) => prev.filter((s) => s.id !== id));
    } catch {
      alert("Erro ao deletar barbearia.");
    } finally {
      setDeleting(null);
      setConfirmId(null);
    }
  }

  const filtered = data.filter((s) => {
    const matchQ      = !q || s.name.toLowerCase().includes(q.toLowerCase()) || s.email.toLowerCase().includes(q.toLowerCase());
    const matchPlan   = planF   === "ALL" || s.planTier  === planF;
    const matchStatus = statusF === "ALL" || s.subStatus === statusF;
    return matchQ && matchPlan && matchStatus;
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Barbearias</h1>
          <p className="text-sm text-muted-foreground">{data.length} total · {filtered.length} exibidas</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou email…" className="pl-9" />
        </div>
        <select value={planF} onChange={(e) => setPlanF(e.target.value)} className="rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground">
          <option value="ALL">Todos os planos</option>
          <option value="FREE">Free</option>
          <option value="STARTER">Starter</option>
          <option value="PRO">Pro</option>
          <option value="ENTERPRISE">Enterprise</option>
        </select>
        <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground">
          <option value="ALL">Todos os status</option>
          <option value="ACTIVE">Active</option>
          <option value="TRIALING">Trialing</option>
          <option value="PAST_DUE">Past Due</option>
          <option value="CANCELED">Canceled</option>
        </select>
      </div>

      {/* Confirm dialog */}
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface-800 border border-border rounded-lg p-6 w-full max-w-sm space-y-4 shadow-xl">
            <p className="text-sm font-semibold text-foreground">Confirmar exclusão</p>
            <p className="text-sm text-muted-foreground">
              Tem certeza? Todos os dados desta barbearia (clientes, campanhas, agendamentos, etc.) serão apagados permanentemente.
            </p>
            <div className="flex gap-3 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)} disabled={!!deleting}>
                Cancelar
              </Button>
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-500 text-white"
                onClick={() => handleDelete(confirmId)}
                disabled={!!deleting}
              >
                {deleting === confirmId ? "Apagando…" : "Apagar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-800 border-b border-border">
            <tr>
              {["Barbearia", "Plano", "Status", "IA usado", "Clientes", "Agend.", "Criada em", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((s) => (
              <tr key={s.id} className="hover:bg-surface-800/50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${PLAN_COLOR[s.planTier] ?? ""}`}>
                    {s.planTier}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLOR[s.subStatus] ?? ""}`}>
                    {s.subStatus}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-foreground">
                    <Brain className="h-3 w-3 text-muted-foreground" />
                    {s.aiUsed}
                    {s.creditBalance > 0 && <span className="text-xs text-gold-400">+{s.creditBalance}</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-3 w-3" /> {s.customers}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-3 w-3" /> {s.appointments}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {new Date(s.createdAt).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <Link href={`/admin/barbershops/${s.id}`}>
                      <Button size="sm" variant="ghost" className="h-7 px-2">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={() => setConfirmId(s.id)}
                      disabled={!!deleting}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">Nenhuma barbearia encontrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
