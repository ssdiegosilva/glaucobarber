"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Scissors, Loader2, Eye, EyeOff } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPwd,  setShowPwd]  = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = getSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError("Email ou senha incorretos.");
      setLoading(false);
      return;
    }

    // Respect redirectTo param, fallback to /dashboard
    // Dashboard layout redirects admin users to /admin automatically (server-side)
    const params = new URLSearchParams(window.location.search);
    const redirectTo = params.get("redirectTo") ?? "/dashboard";
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-1 text-center">
        <div className="flex items-center justify-center mb-4 lg:hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500/15 border border-gold-500/30">
            <Scissors className="h-5 w-5 text-gold-400" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Entrar</h1>
        <p className="text-sm text-muted-foreground">Acesse seu painel da barbearia</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="glauco@artshave.com.br"
            className="w-full rounded-md border border-border bg-surface-800 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-foreground">Senha</label>
            <Link href="/forgot-password" className="text-xs text-gold-400 hover:underline font-medium">
              Esqueci minha senha
            </Link>
          </div>
          <div className="relative">
            <input
              type={showPwd ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-md border border-border bg-surface-800 px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-400 rounded-md border border-red-500/20 bg-red-500/8 px-3 py-2">{error}</p>
        )}

        <Button type="submit" className="w-full" disabled={loading || !email || !password}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
        </Button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        Não tem conta?{" "}
        <Link href="/signup" className="text-gold-400 hover:underline font-medium">
          Criar conta
        </Link>
      </p>
    </div>
  );
}
