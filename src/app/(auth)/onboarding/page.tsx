import { Scissors, Plug, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const STEPS = [
  {
    icon: Scissors,
    title: "Crie sua barbearia",
    desc:  "Nome, endereço e dados básicos",
  },
  {
    icon: Plug,
    title: "Conecte a Trinks",
    desc:  "Importe agenda, clientes e serviços automaticamente",
  },
  {
    icon: Sparkles,
    title: "Ative a IA",
    desc:  "Sugestões diárias de crescimento e automação",
  },
];

export default function OnboardingPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center space-y-2">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gold-500/15 border border-gold-500/30 mb-4">
          <Scissors className="h-6 w-6 text-gold-400" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Bem-vindo!</h1>
        <p className="text-sm text-muted-foreground">
          Vamos configurar seu copiloto em 3 passos simples
        </p>
      </div>

      <div className="space-y-3">
        {STEPS.map((step, i) => (
          <div key={i} className="flex items-start gap-4 rounded-lg border border-border bg-card p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-500/10 border border-gold-500/20 shrink-0">
              <step.icon className="h-4 w-4 text-gold-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{step.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
            </div>
            <div className="ml-auto">
              <div className="flex h-5 w-5 items-center justify-center rounded-full border border-border text-xs text-muted-foreground font-bold">
                {i + 1}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button className="w-full" asChild>
        <Link href="/dashboard">Começar configuração</Link>
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Você pode configurar a Trinks depois em{" "}
        <Link href="/integrations" className="text-gold-400 hover:underline">Integrações</Link>
      </p>
    </div>
  );
}
