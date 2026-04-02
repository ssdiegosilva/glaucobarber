import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { planTier, status, trialEndsAt } = await req.json();

  const sub = await prisma.platformSubscription.upsert({
    where:  { barbershopId: id },
    update: {
      ...(planTier    ? { planTier }    : {}),
      ...(status      ? { status }      : {}),
      ...(trialEndsAt !== undefined ? { trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : null } : {}),
    },
    create: {
      barbershopId: id,
      planTier: planTier ?? "FREE",
      status:   status   ?? "ACTIVE",
    },
  });

  await prisma.auditLog.create({
    data: {
      barbershopId: id,
      userId:       session.user.id,
      action:       "admin.plan.override",
      entity:       "PlatformSubscription",
      entityId:     sub.id,
      metadata:     JSON.stringify({ planTier, status, trialEndsAt, by: session.user.email }),
    },
  });

  return NextResponse.json({ ok: true, planTier: sub.planTier, status: sub.status });
}
