import Link from "next/link";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const PLAN_LABEL: Record<string, string> = {
  PRO:        "Pro",
  STARTER:    "Start",
  ENTERPRISE: "Enterprise",
};

interface Props {
  feature:      string;   // e.g. "Gestão Financeira"
  requiredPlan: string;   // e.g. "PRO"
  description?: string;
}

export function UpgradeWall({ feature, requiredPlan, description }: Props) {
  const planLabel = PLAN_LABEL[requiredPlan] ?? requiredPlan;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
      <div className="max-w-md w-full rounded-xl border border-gold-500/30 bg-gold-500/5 p-8 text-center space-y-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold-500/15 border border-gold-500/30 mx-auto">
          <Lock className="h-6 w-6 text-gold-400" />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground">{feature}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {description ?? `Este recurso está disponível no plano ${planLabel}.`}
          </p>
        </div>

        <div className="rounded-lg border border-border/60 bg-surface-900 p-4 text-left space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold-400" />
            <span className="text-sm font-medium text-foreground">Plano {planLabel}</span>
          </div>
          {requiredPlan === "PRO" && (
            <ul className="text-xs text-muted-foreground space-y-1 ml-6">
              <li>• R$149/mês base + R$1,50 por atendimento concluído</li>
              <li>• 1.000 chamadas de IA por mês</li>
              <li>• Gestão financeira com metas e análise</li>
              <li>• Todos os recursos desbloqueados</li>
            </ul>
          )}
          {requiredPlan === "STARTER" && (
            <ul className="text-xs text-muted-foreground space-y-1 ml-6">
              <li>• R$89/mês</li>
              <li>• 200 chamadas de IA por mês</li>
              <li>• Pós-venda, copilot e campanhas</li>
            </ul>
          )}
        </div>

        <Button asChild className="w-full gap-2">
          <Link href="/billing">
            <Sparkles className="h-4 w-4" />
            Ver planos e fazer upgrade
          </Link>
        </Button>

        <p className="text-xs text-muted-foreground">
          Você está no plano gratuito. Faça upgrade a qualquer momento.
        </p>
      </div>
    </div>
  );
}
