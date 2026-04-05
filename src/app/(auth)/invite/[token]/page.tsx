"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Scissors, Loader2, Eye, EyeOff, UserPlus } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface InviteInfo {
  email:          string;
  name:           string;
  barbershopName: string;
  role:           string;
  hasAccount:     boolean;
}

export default function InvitePage() {
  const router = useRouter();
  const params = useParams();
  const token  = params.token as string;

  const [info, setInfo]         = useState<InviteInfo | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    fetch(`/api/invite/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setInfo(data);
        }
      })
      .catch(() => setError("Erro ao carregar convite."))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!info) return;
    setSaving(true);
    setError("");

    try {
      const supabase = getSupabaseBrowserClient();

      if (info.hasAccount) {
        // User already has Supabase auth — just log in
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: info.email,
          password,
        });
        if (signInError) {
          setError("Senha incorreta.");
          setSaving(false);
          return;
        }
      } else {
        // Create new Supabase auth account
        const { error: signUpError } = await supabase.auth.signUp({
          email: info.email,
          password,
          options: { data: { full_name: info.name } },
        });
        if (signUpError) {
          setError(signUpError.message);
          setSaving(false);
          return;
        }
      }

      // Accept the invite (clears the token)
      const res = await fetch(`/api/invite/${token}/accept`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Erro ao aceitar convite.");
        setSaving(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Erro inesperado.");
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gold-400" />
      </div>
    );
  }

  if (error && !info) {
    return (
      <div className="space-y-6 animate-fade-in text-center">
        <div className="flex items-center justify-center mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/15 border border-red-500/30">
            <UserPlus className="h-6 w-6 text-red-400" />
          </div>
        </div>
        <h1 className="text-xl font-bold text-foreground">Convite inválido</h1>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!info) return null;

  const ROLE_LABELS: Record<string, string> = {
    OWNER:  "Dono",
    BARBER: "Barbeiro",
    STAFF:  "Equipe",
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-1 text-center">
        <div className="flex items-center justify-center mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold-500/15 border border-gold-500/30">
            <Scissors className="h-6 w-6 text-gold-400" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Você foi convidado!</h1>
        <p className="text-sm text-muted-foreground">
          Entre como <span className="text-foreground font-medium">{ROLE_LABELS[info.role] ?? info.role}</span> na
        </p>
        <p className="text-base font-semibold text-gold-400">{info.barbershopName}</p>
      </div>

      <div className="rounded-lg border border-border/60 bg-surface-800/40 px-4 py-3 space-y-1">
        <p className="text-sm text-foreground">{info.name}</p>
        <p className="text-xs text-muted-foreground">{info.email}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">
            {info.hasAccount ? "Sua senha" : "Crie uma senha"}
          </label>
          <div className="relative">
            <input
              type={showPwd ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-md border border-border bg-surface-800 px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {!info.hasAccount && (
            <p className="text-[11px] text-muted-foreground">Mínimo 6 caracteres.</p>
          )}
        </div>

        {error && (
          <p className="text-xs text-red-400 rounded-md border border-red-500/20 bg-red-500/8 px-3 py-2">{error}</p>
        )}

        <Button type="submit" className="w-full" disabled={saving || !password}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (info.hasAccount ? "Entrar" : "Criar conta e entrar")}
        </Button>
      </form>
    </div>
  );
}
