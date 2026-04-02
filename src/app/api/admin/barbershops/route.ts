import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const plan   = searchParams.get("plan") ?? undefined;
  const status = searchParams.get("status") ?? undefined;

  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const shops = await prisma.barbershop.findMany({
    where: {
      slug: { not: "__platform_admin__" },
      ...(plan || status ? {
        subscription: {
          ...(plan   ? { planTier: plan as never }   : {}),
          ...(status ? { status:   status as never } : {}),
        },
      } : {}),
    },
    include: {
      subscription: true,
      _count: { select: { customers: true, appointments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Fetch AI usage for this month for all shops
  const shopIds = shops.map((s) => s.id);
  const aiUsages = await prisma.aiUsageMonth.findMany({
    where: { barbershopId: { in: shopIds }, yearMonth: { in: [yearMonth, "trial"] } },
  });
  const aiMap = Object.fromEntries(aiUsages.map((u) => [u.barbershopId, u.usageCount]));

  return NextResponse.json(
    shops.map((s) => ({
      id:           s.id,
      name:         s.name,
      slug:         s.slug,
      email:        s.email,
      city:         s.city,
      state:        s.state,
      createdAt:    s.createdAt,
      customers:    s._count.customers,
      appointments: s._count.appointments,
      aiUsed:       aiMap[s.id] ?? 0,
      subscription: s.subscription ? {
        planTier:          s.subscription.planTier,
        status:            s.subscription.status,
        currentPeriodEnd:  s.subscription.currentPeriodEnd,
        trialEndsAt:       s.subscription.trialEndsAt,
        cancelAtPeriodEnd: s.subscription.cancelAtPeriodEnd,
        aiCreditBalance:   s.subscription.aiCreditBalance,
        stripeCustomerId:  s.stripeCustomerId,
      } : null,
    }))
  );
}
