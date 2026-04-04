import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkAiAllowance } from "@/lib/billing";

export async function GET() {
  const session = await auth();
  if (!session?.user?.barbershopId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowance = await checkAiAllowance(session.user.barbershopId);

  return NextResponse.json({
    used:       allowance.used,
    limit:      allowance.limit === Infinity ? 999 : allowance.limit,
    credits:    allowance.creditsRemaining,
    isTrialing: allowance.planStatus === "TRIALING",
  });
}
