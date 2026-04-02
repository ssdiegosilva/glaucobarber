import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { credits } = await req.json();
  if (!credits || credits <= 0) return NextResponse.json({ error: "credits must be > 0" }, { status: 400 });

  const sub = await prisma.platformSubscription.upsert({
    where:  { barbershopId: id },
    update: { aiCreditBalance: { increment: credits } },
    create: { barbershopId: id, planTier: "FREE", status: "ACTIVE", aiCreditBalance: credits },
  });

  await prisma.auditLog.create({
    data: {
      barbershopId: id,
      userId:       session.user.id,
      action:       "admin.credits.add",
      entity:       "PlatformSubscription",
      entityId:     sub.id,
      metadata:     JSON.stringify({ credits, by: session.user.email }),
    },
  });

  return NextResponse.json({ ok: true, aiCreditBalance: sub.aiCreditBalance });
}
