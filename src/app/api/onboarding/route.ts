import { NextRequest, NextResponse } from "next/server";
import { auth, ACTIVE_BARBERSHOP_COOKIE } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getKillSwitch } from "@/lib/platform-config";

// GET — check if user already has a membership (skip onboarding)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id, active: true, role: { not: "PLATFORM_ADMIN" } },
    select: { barbershopId: true },
  });

  return NextResponse.json({
    hasMembership:  !!membership,
    barbershopId:   membership?.barbershopId ?? null,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  if (await getKillSwitch("kill_new_signups")) {
    return NextResponse.json({ error: "Novos cadastros temporariamente suspensos. Tente novamente em breve." }, { status: 503 });
  }

  const { name, slug } = await req.json();

  if (!name?.trim() || !slug?.trim()) {
    return NextResponse.json({ error: "Nome e slug são obrigatórios" }, { status: 400 });
  }

  // Check slug uniqueness
  const existing = await prisma.barbershop.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "Essa URL já está em uso. Escolha outra." }, { status: 409 });
  }

  // Create barbershop + membership in a transaction
  const barbershop = await prisma.$transaction(async (tx) => {
    const shop = await tx.barbershop.create({
      data: {
        name: name.trim(),
        slug,
        trinksConfigured: false,
      },
    });

    await tx.membership.create({
      data: {
        userId:       session.user.id,
        barbershopId: shop.id,
        role:         "OWNER",
        active:       true,
      },
    });

    // Auto-create TRIAL subscription — 10 days full access, then migrates to FREE via cron
    const now        = new Date();
    const trialEnd   = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
    await tx.platformSubscription.create({
      data: {
        barbershopId:       shop.id,
        planTier:           "FREE",
        status:             "TRIALING",
        currentPeriodStart: now,
        currentPeriodEnd:   trialEnd,
        trialEndsAt:        trialEnd,
      },
    });

    return shop;
  });

  // Set active barbershop cookie so the user switches to the new one
  const res = NextResponse.json({ barbershopId: barbershop.id });
  res.cookies.set(ACTIVE_BARBERSHOP_COOKIE, barbershop.id, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
