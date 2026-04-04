"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Scissors, Loader2, Eye, EyeOff, CheckCircle } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);

    const supabase = getSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError("Erro ao redefinir senha. O link pode ter expirado. Solicite um novo.");
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);

    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 2000);
  }

  if (success) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="space-y-1 text-center">
          <div className="flex items-center justify-center mb-4 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500/15 border border-gold-500/30">
              <Scissors className="h-5 w-5 text-gold-400" />
            </div>
          </div>
          <div className="flex items-center justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/15 border border-green-500/30">
              <CheckCircle className="h-6 w-6 text-green-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Senha redefinida</h1>
          <p className="text-sm text-muted-foreground">
            Sua senha foi atualizada com sucesso. Redirecionando...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-1 text-center">
        <div className="flex items-center justify-center mb-4 lg:hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500/15 border border-gold-500/30">
            <Scissors className="h-5 w-5 text-gold-400" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Nova senha</h1>
        <p className="text-sm text-muted-foreground">Digite sua nova senha abaixo</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Nova senha</label>
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

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Confirmar nova senha</label>
          <div className="relative">
            <input
              type={showConfirmPwd ? "text" : "password"}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-md border border-border bg-surface-800 px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPwd(!showConfirmPwd)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showConfirmPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-400 rounded-md border border-red-500/20 bg-red-500/8 px-3 py-2">{error}</p>
        )}

        <Button type="submit" className="w-full" disabled={loading || !password || !confirmPassword}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Redefinir senha"}
        </Button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        <Link href="/login" className="text-gold-400 hover:underline font-medium">
          Voltar para o login
        </Link>
      </p>
    </div>
  );
}
