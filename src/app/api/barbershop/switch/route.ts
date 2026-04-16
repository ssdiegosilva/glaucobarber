import { NextRequest, NextResponse } from "next/server";
import { auth, ACTIVE_BARBERSHOP_COOKIE } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { barbershopId } = await req.json();
  if (!barbershopId) {
    return NextResponse.json({ error: "barbershopId é obrigatório" }, { status: 400 });
  }

  // Verify user has an active membership in this barbershop
  const membership = await prisma.membership.findUnique({
    where: { userId_barbershopId: { userId: session.user.id, barbershopId } },
    select: { active: true },
  });

  if (!membership?.active) {
    return NextResponse.json({ error: "Você não é membro desta barbearia" }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACTIVE_BARBERSHOP_COOKIE, barbershopId, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  return res;
}
