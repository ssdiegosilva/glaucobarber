import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/utils";
import { PLANS } from "@/lib/stripe";
import { CreditCard, Building2, CheckCircle2 } from "lucide-react";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.barbershopId) redirect("/onboarding");

  const barbershop = await prisma.barbershop.findUnique({
    where:   { id: session.user.barbershopId },
    include: { subscription: true },
  });

  const currentPlan = barbershop?.subscription?.planTier ?? null;

  return (
    <div className="flex flex-col h-full">
      <Header title="Configurações" userName={session.user.name} />

      <div className="p-6 space-y-6 max-w-3xl">
        {/* Barbershop info */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-gold-400" />
              <CardTitle className="text-base">Dados da Barbearia</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Nome"     value={barbershop?.name ?? "—"} />
            <Row label="Email"    value={barbershop?.email ?? "—"} />
            <Row label="Telefone" value={barbershop?.phone ?? "—"} />
            <Row label="Cidade"   value={barbershop?.city ? `${barbershop.city} / ${barbershop.state}` : "—"} />
          </CardContent>
        </Card>

        {/* Subscription / Billing */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-gold-400" />
                <CardTitle className="text-base">Plano & Billing</CardTitle>
              </div>
              {currentPlan ? (
                <Badge variant="success">{currentPlan}</Badge>
              ) : (
                <Badge variant="outline">Sem plano ativo</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(Object.entries(PLANS) as [string, typeof PLANS[keyof typeof PLANS]][]).map(([key, plan]) => (
                <div
                  key={key}
                  className={`rounded-lg border p-4 transition-colors ${
                    currentPlan === key
                      ? "border-gold-500/40 bg-gold-500/8"
                      : "border-border hover:border-gold-500/20"
                  }`}
                >
                  {"popular" in plan && plan.popular && (
                    <Badge variant="default" className="text-[10px] mb-2">Mais popular</Badge>
                  )}
                  <p className="font-semibold text-foreground">{plan.name}</p>
                  <p className="text-xl font-bold text-gold-400 mt-1">
                    {formatBRL(plan.monthlyBRL / 100)}
                    <span className="text-xs text-muted-foreground font-normal">/mês</span>
                  </p>
                  <ul className="mt-3 space-y-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3 text-green-400 shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4">
                    {currentPlan === key ? (
                      <Button variant="outline" size="sm" className="w-full text-xs h-8">
                        Gerenciar plano
                      </Button>
                    ) : (
                      <form action="/api/stripe/checkout" method="POST">
                        <input type="hidden" name="priceId" value={plan.priceId} />
                        <Button size="sm" variant={currentPlan ? "outline" : "default"} className="w-full text-xs h-8">
                          {currentPlan ? "Trocar para" : "Assinar"} {plan.name}
                        </Button>
                      </form>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  );
}
