import { requireBarbershop } from "@/lib/auth";
import { Header } from "@/components/layout/header";
import CriarVisualClient from "./criar-visual-client";
import { canAccess } from "@/lib/access";
import { getPlan } from "@/lib/billing";
import { UpgradeWall } from "@/components/billing/UpgradeWall";

export default async function CriarVisualPage() {
  const session = await requireBarbershop();

  const { effectiveTier } = await getPlan(session.user.barbershopId);
  const allowed = await canAccess(session.user.barbershopId, effectiveTier, "criar-visual");

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Criar Visual"
        subtitle="Envie a foto do cliente e a IA sugere e gera o corte ideal"
        userName={session.user.name}
      />
      {allowed ? (
        <CriarVisualClient />
      ) : (
        <UpgradeWall
          feature="Criar Visual"
          requiredPlan="PRO"
          description="Envie a foto do cliente e a IA analisa o formato do rosto, sugere o corte ideal e gera uma prévia visual."
        />
      )}
    </div>
  );
}
