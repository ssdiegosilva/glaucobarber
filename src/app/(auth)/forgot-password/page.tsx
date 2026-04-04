"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Scissors, Loader2, ArrowLeft, Mail } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = getSupabaseBrowserClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    if (resetError) {
      setError("Erro ao enviar email de recuperação. Tente novamente.");
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  if (sent) {
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
              <Mail className="h-6 w-6 text-green-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Email enviado</h1>
          <p className="text-sm text-muted-foreground">
            Se existe uma conta com <span className="text-foreground font-medium">{email}</span>,
            você receberá um link para redefinir sua senha.
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          <Link href="/login" className="text-gold-400 hover:underline font-medium inline-flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" />
            Voltar para o login
          </Link>
        </p>
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
        <h1 className="text-2xl font-bold text-foreground">Esqueci minha senha</h1>
        <p className="text-sm text-muted-foreground">
          Digite seu email e enviaremos um link para redefinir sua senha
        </p>
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

        {error && (
          <p className="text-xs text-red-400 rounded-md border border-red-500/20 bg-red-500/8 px-3 py-2">{error}</p>
        )}

        <Button type="submit" className="w-full" disabled={loading || !email}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar link de recuperação"}
        </Button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        <Link href="/login" className="text-gold-400 hover:underline font-medium inline-flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" />
          Voltar para o login
        </Link>
      </p>
    </div>
  );
}
