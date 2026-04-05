"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Scissors, Loader2 } from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const [name,      setName]      = useState("");
  const [slug,      setSlug]      = useState("");
  const [error,     setError]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [checking,  setChecking]  = useState(true);

  // Check if user already has a membership (invited by another barbershop)
  useEffect(() => {
    fetch("/api/onboarding")
      .then((r) => r.json())
      .then((data) => {
        if (data.hasMembership) {
          router.replace("/dashboard");
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [router]);

  function handleNameChange(value: string) {
    setName(value);
    // Auto-generate slug from name
    setSlug(value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Erro ao criar barbearia.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  if (checking) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gold-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-1 text-center">
        <div className="flex items-center justify-center mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold-500/15 border border-gold-500/30">
            <Scissors className="h-6 w-6 text-gold-400" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Bem-vindo!</h1>
        <p className="text-sm text-muted-foreground">Crie sua barbearia para começar</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Nome da barbearia</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Art Shave Barbearia"
            className="w-full rounded-md border border-border bg-surface-800 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">URL da barbearia</label>
          <div className="flex items-center rounded-md border border-border bg-surface-800 px-3 py-2.5 text-sm">
            <span className="text-muted-foreground shrink-0">glaucobarber.com/</span>
            <input
              type="text"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="art-shave"
              className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none ml-1"
            />
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-400 rounded-md border border-red-500/20 bg-red-500/8 px-3 py-2">{error}</p>
        )}

        <Button type="submit" className="w-full" disabled={loading || !name || !slug}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar barbearia e entrar"}
        </Button>
      </form>
    </div>
  );
}
