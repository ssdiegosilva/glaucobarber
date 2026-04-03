import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { FinanceiroClient } from "./financeiro-client";
import { getPlan, hasFeature } from "@/lib/billing";
import { UpgradeWall } from "@/components/billing/UpgradeWall";
import { getMonthlyFinanceiroData } from "@/lib/financeiro/monthly-data";

export default async function FinanceiroPage() {
  const session = await auth();
  if (!session?.user?.barbershopId) redirect("/login");

  const barbershopId = session.user.barbershopId;

  const { effectiveTier } = await getPlan(barbershopId);
  if (!hasFeature(effectiveTier, "financeiro")) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Gestão Financeira" subtitle="Metas e análise de faturamento" userName={session.user.name} />
        <UpgradeWall
          feature="Gestão Financeira"
          requiredPlan="PRO"
          description="Defina metas de faturamento, acompanhe o progresso diário e use a IA para sugerir metas realistas."
        />
      </div>
    );
  }

  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();

  const initialData = await getMonthlyFinanceiroData(barbershopId, month, year);

  return (
    <div className="flex flex-col h-full">
      <Header title="Financeiro" subtitle="Análise mensal e anual" userName={session.user.name} />
      <div className="p-4 sm:p-6 overflow-y-auto">
        <FinanceiroClient
          initialData={initialData}
          currentMonth={month}
          currentYear={year}
        />
      </div>
    </div>
  );
}
