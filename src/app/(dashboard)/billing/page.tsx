import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { BillingClient } from "./billing-client";
import { getPlan, checkAiAllowance, PLAN_LIMITS, APPOINTMENT_FEE_CENTS, APPOINTMENT_FEE_CAP_CENTS } from "@/lib/billing";
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

  const [plan, allowance, billingStats, featureMatrix] = await Promise.all([
    getPlan(barbershopId),
    checkAiAllowance(barbershopId),
    prisma.billingEvent.aggregate({
      where:  { barbershopId, yearMonth },
      _sum:   { amountCents: true },
      _count: { _all: true },
    }),
    getFullFeatureMatrix(),
  ]);

  const limits = PLAN_LIMITS[plan.tier];

  const appointmentCount  = billingStats._count._all;
  const appointmentCents  = billingStats._sum.amountCents ?? 0;

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
        appointmentCount={appointmentCount}
        appointmentCents={appointmentCents}
        appointmentFeeCents={APPOINTMENT_FEE_CENTS}
        appointmentCapCents={APPOINTMENT_FEE_CAP_CENTS}
        hasAppointmentFee={limits.appointmentFee}
        yearMonth={yearMonth}
        stripeCustomerId={plan.stripeCustomerId}
        featureMatrix={featureMatrix}
        allFeatures={ALL_FEATURES.map((f) => ({ key: f.key, label: f.label }))}
        trialEndsAt={plan.trialEndsAt?.toISOString() ?? null}
        currentPeriodEnd={plan.currentPeriodEnd?.toISOString() ?? null}
        cancelAtPeriodEnd={plan.cancelAtPeriodEnd}
        priceIdStart={process.env.STRIPE_PRICE_STARTER_MONTHLY ?? ""}
        priceIdPro={process.env.STRIPE_PRICE_PRO_MONTHLY ?? ""}
      />
    </div>
  );
}
