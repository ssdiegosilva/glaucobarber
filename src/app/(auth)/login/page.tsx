"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Scissors, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError("Email ou senha inválidos.");
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
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
          <label className="text-xs font-medium text-foreground">Senha</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-md border border-border bg-surface-800 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
          />
        </div>

        {error && (
          <p className="text-xs text-red-400 rounded-md border border-red-500/20 bg-red-500/8 px-3 py-2">{error}</p>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
        </Button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        Não tem conta?{" "}
        <Link href="/signup" className="text-gold-400 hover:underline font-medium">
          Criar conta
        </Link>
      </p>

      <p className="text-center text-[10px] text-muted-foreground/50">
        Demo: glauco@artshave.com.br / demo1234
      </p>
    </div>
  );
}
