"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Scissors } from "lucide-react";

export default function SignupPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-1 text-center">
        <div className="flex items-center justify-center mb-4 lg:hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500/15 border border-gold-500/30">
            <Scissors className="h-5 w-5 text-gold-400" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Criar conta</h1>
        <p className="text-sm text-muted-foreground">Comece gratuitamente por 14 dias</p>
      </div>

      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Nome</label>
            <input type="text" placeholder="Glauco" className="w-full rounded-md border border-border bg-surface-800 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Sobrenome</label>
            <input type="text" placeholder="Silva" className="w-full rounded-md border border-border bg-surface-800 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Email</label>
          <input type="email" placeholder="glauco@artshave.com.br" className="w-full rounded-md border border-border bg-surface-800 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Nome da barbearia</label>
          <input type="text" placeholder="Art Shave Barbearia" className="w-full rounded-md border border-border bg-surface-800 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Senha</label>
          <input type="password" placeholder="••••••••" className="w-full rounded-md border border-border bg-surface-800 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>

        <Button type="submit" className="w-full">
          Criar conta — 14 dias grátis
        </Button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        Já tem conta?{" "}
        <Link href="/login" className="text-gold-400 hover:underline font-medium">Entrar</Link>
      </p>

      <p className="text-[10px] text-center text-muted-foreground/50">
        Ao criar, você concorda com os termos de serviço.
      </p>
    </div>
  );
}
