"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus, Trash2, Crown, Scissors, User, Copy, Check, Link2, LogOut } from "lucide-react";

interface Member {
  id:        string;
  userId:    string;
  name:      string | null;
  email:     string;
  role:      string;
  active:    boolean;
  trinksId:  string | null;
  createdAt: string;
}

interface Props {
  initialMembers: Member[];
  isOwner:        boolean;
}

const ROLE_LABELS: Record<string, string> = {
  OWNER:  "Dono",
  BARBER: "Barbeiro",
  STAFF:  "Equipe",
};

const ROLE_ICONS: Record<string, typeof Crown> = {
  OWNER:  Crown,
  BARBER: Scissors,
  STAFF:  User,
};

export function TeamCard({ initialMembers, isOwner }: Props) {
  const [members, setMembers]       = useState<Member[]>(initialMembers);
  const [adding, setAdding]         = useState(false);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied]         = useState(false);

  // New member form
  const [newName, setNewName]   = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole]   = useState("BARBER");

  async function handleAdd() {
    if (!newName.trim() || !newEmail.trim()) {
      setError("Nome e email são obrigatórios.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/barbershop/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, email: newEmail, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao adicionar");
      setMembers((prev) => [...prev, data.member]);
      // Build invite link
      if (data.member.inviteToken) {
        const link = `${window.location.origin}/invite/${data.member.inviteToken}`;
        setInviteLink(link);
      }
      setNewName("");
      setNewEmail("");
      setNewRole("BARBER");
      setAdding(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(membershipId: string, role: string) {
    try {
      await fetch("/api/barbershop/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId, role }),
      });
      setMembers((prev) => prev.map((m) => (m.id === membershipId ? { ...m, role } : m)));
    } catch {}
  }

  async function handleRemove(membershipId: string) {
    if (!confirm("Tem certeza que deseja remover este membro?")) return;
    try {
      const res = await fetch("/api/barbershop/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId }),
      });
      if (res.ok) setMembers((prev) => prev.filter((m) => m.id !== membershipId));
    } catch {}
  }

  async function handleLeave() {
    if (!confirm("Tem certeza que deseja sair desta barbearia? Você perderá o acesso.")) return;
    try {
      const res = await fetch("/api/barbershop/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ self: true }),
      });
      if (res.ok) {
        window.location.href = "/dashboard";
      }
    } catch {}
  }

  function handleCopyLink() {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-3">
      {/* Invite link banner */}
      {inviteLink && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/8 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <p className="text-sm font-medium text-foreground">Membro adicionado! Envie o link de convite:</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={inviteLink}
              className="flex-1 rounded-md border border-border bg-surface-900 px-3 py-2 text-xs text-foreground truncate focus:outline-none"
            />
            <Button size="sm" variant="outline" onClick={handleCopyLink} className="shrink-0">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span className="ml-1">{copied ? "Copiado" : "Copiar"}</span>
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            O convidado vai criar uma senha e entrar direto na barbearia.
          </p>
          <button
            onClick={() => { setInviteLink(null); setCopied(false); }}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Members list */}
      <div className="space-y-2">
        {members.map((m) => {
          const RoleIcon = ROLE_ICONS[m.role] ?? User;
          return (
            <div
              key={m.id}
              className="flex items-center gap-3 rounded-lg border border-border/60 bg-surface-800/40 px-4 py-3"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-500/10 border border-gold-500/20 shrink-0">
                <RoleIcon className="h-4 w-4 text-gold-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {m.name ?? "Sem nome"}
                  {m.trinksId && (
                    <span className="ml-2 text-[10px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
                      Trinks
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground truncate">{m.email}</p>
              </div>

              {isOwner && m.role !== "OWNER" ? (
                <select
                  value={m.role}
                  onChange={(e) => handleRoleChange(m.id, e.target.value)}
                  className="rounded-md border border-border bg-surface-900 px-2 py-1 text-xs text-foreground focus:outline-none"
                >
                  <option value="BARBER">Barbeiro</option>
                  <option value="STAFF">Equipe</option>
                  <option value="OWNER">Dono</option>
                </select>
              ) : (
                <span className="text-xs font-medium text-muted-foreground bg-muted/30 px-2 py-1 rounded">
                  {ROLE_LABELS[m.role] ?? m.role}
                </span>
              )}

              {isOwner && m.role !== "OWNER" && (
                <button
                  onClick={() => handleRemove(m.id)}
                  className="text-muted-foreground hover:text-red-400 transition-colors p-1"
                  title="Remover membro"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add new member */}
      {isOwner && !adding && (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          <UserPlus className="h-3.5 w-3.5 mr-1.5" />
          Adicionar membro
        </Button>
      )}

      {isOwner && adding && (
        <div className="rounded-lg border border-border/60 bg-surface-800/40 p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Novo membro</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Nome</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="João Silva"
                className="w-full rounded-md border border-border bg-surface-900 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Email</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="joao@email.com"
                className="w-full rounded-md border border-border bg-surface-900 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Papel</label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-900 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="BARBER">Barbeiro</option>
              <option value="STAFF">Equipe</option>
              <option value="OWNER">Dono</option>
            </select>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Adicionar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setError(null); }}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
      {/* Self-removal for non-owners */}
      {!isOwner && (
        <div className="pt-2 border-t border-border/40">
          <button
            onClick={handleLeave}
            className="flex items-center gap-2 text-xs text-red-400 hover:text-red-300 transition-colors py-1"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair desta barbearia
          </button>
        </div>
      )}
    </div>
  );
}
