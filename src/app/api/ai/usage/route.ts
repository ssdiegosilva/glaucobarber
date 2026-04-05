import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkAiAllowance, getPlan } from "@/lib/billing";

export async function GET() {
  const session = await auth();
  if (!session?.user?.barbershopId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [allowance, plan] = await Promise.all([
    checkAiAllowance(session.user.barbershopId),
    getPlan(session.user.barbershopId),
  ]);

  return NextResponse.json({
    used:              allowance.used,
    limit:             allowance.limit === Infinity ? 999 : allowance.limit,
    credits:           allowance.creditsRemaining,
    creditsPurchased:  plan.aiCreditsPurchased,
    isTrialing:        allowance.planStatus === "TRIALING",
  });
}
