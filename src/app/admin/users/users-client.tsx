"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ShieldCheck, Trash2 } from "lucide-react";

type Membership = { id: string; role: string; active: boolean; barbershopId: string; barbershopName: string; barbershopSlug: string };
type User = { id: string; name: string; email: string; createdAt: string; memberships: Membership[] };

const ROLE_COLOR: Record<string, string> = {
  PLATFORM_ADMIN: "border-red-500/30 bg-red-500/10 text-red-400",
  OWNER:  "border-gold-500/30 bg-gold-500/10 text-gold-400",
  BARBER: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  STAFF:  "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
};

export function UsersClient({ data }: { data: User[] }) {
  const router = useRouter();
  const [q,       setQ]       = useState("");
  const [saving,  setSaving]  = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const filtered = data.filter((u) =>
    !q || u.name.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase())
  );

  async function deleteUser(userId: string, userName: string) {
    if (!confirm(`Apagar o usuário "${userName || "sem nome"}"? Esta ação é irreversível.`)) return;
    setDeleting(userId);
    await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    setDeleting(null);
    router.refresh();
  }

  async function toggleActive(membershipId: string, active: boolean) {
    setSaving(membershipId);
    await fetch(`/api/admin/users/${membershipId}/role`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    setSaving(null);
    router.refresh();
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Usuários</h1>
        <p className="text-sm text-muted-foreground">{data.length} usuários cadastrados</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou email…" className="pl-9" />
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-800 border-b border-border">
            <tr>
              {["Usuário", "Memberships", "Cadastrado em", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-surface-800/40">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {u.memberships.some((m) => m.role === "PLATFORM_ADMIN") && (
                      <ShieldCheck className="h-4 w-4 text-red-400 shrink-0" />
                    )}
                    <div>
                      <p className="font-medium text-foreground">{u.name || "(sem nome)"}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {u.memberships.filter((m) => m.barbershopSlug !== "__platform_admin__").map((m) => (
                      <div key={m.id} className="flex items-center gap-1">
                        <span className={`text-[10px] border rounded-full px-1.5 py-0.5 ${ROLE_COLOR[m.role] ?? ""}`}>{m.role}</span>
                        <span className="text-xs text-muted-foreground">{m.barbershopName}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={saving === m.id}
                          onClick={() => toggleActive(m.id, !m.active)}
                          className={`h-5 px-1.5 text-[10px] rounded border ${m.active ? "border-red-500/30 text-red-400 hover:bg-red-500/10" : "border-green-500/30 text-green-400 hover:bg-green-500/10"}`}
                        >
                          {m.active ? "Desativar" : "Ativar"}
                        </Button>
                      </div>
                    ))}
                    {u.memberships.filter((m) => m.barbershopSlug !== "__platform_admin__").length === 0 && (
                      <span className="text-xs text-muted-foreground italic">Sem barbearia</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={deleting === u.id}
                    onClick={() => deleteUser(u.id, u.name)}
                    className="h-7 w-7 p-0 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
