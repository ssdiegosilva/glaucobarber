import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { BillingClient } from "./billing-client";
import { getPlan, checkAiAllowance } from "@/lib/billing";
import { getFullFeatureMatrix, ALL_FEATURES } from "@/lib/access";

function currentYearMonth() {
  const now  = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user?.barbershopId) redirect("/login");

  const barbershopId = session.user.barbershopId;
  const yearMonth    = currentYearMonth();

  const [plan, allowance, featureMatrix] = await Promise.all([
    getPlan(barbershopId),
    checkAiAllowance(barbershopId),
    getFullFeatureMatrix(),
  ]);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Plano e Cobrança"
        subtitle="Gerencie seu plano e uso de recursos"
        userName={session.user.name}
      />
      <BillingClient
        planTier={plan.tier}
        planStatus={plan.status}
        aiUsed={allowance.used}
        aiLimit={allowance.limit}
        aiCreditsRemaining={allowance.creditsRemaining}
        aiCreditsPurchased={plan.aiCreditsPurchased}
        yearMonth={yearMonth}
        stripeCustomerId={plan.stripeCustomerId}
        featureMatrix={featureMatrix}
        allFeatures={ALL_FEATURES.map((f) => ({ key: f.key, label: f.label }))}
        trialEndsAt={plan.trialEndsAt?.toISOString() ?? null}
        currentPeriodEnd={plan.currentPeriodEnd?.toISOString() ?? null}
        cancelAtPeriodEnd={plan.cancelAtPeriodEnd}
        priceIdPro={process.env.STRIPE_PRICE_PRO_MONTHLY ?? ""}
      />
    </div>
  );
}
