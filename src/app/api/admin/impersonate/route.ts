import { NextRequest, NextResponse } from "next/server";
import { auth, IMPERSONATE_COOKIE } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/admin/impersonate — start impersonating a barbershop
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { barbershopId } = await req.json();
  if (!barbershopId) {
    return NextResponse.json({ error: "barbershopId required" }, { status: 400 });
  }

  const shop = await prisma.barbershop.findUnique({
    where: { id: barbershopId },
    select: { id: true, slug: true },
  });
  if (!shop || shop.slug === "__platform_admin__") {
    return NextResponse.json({ error: "Barbershop not found" }, { status: 404 });
  }

  const res = NextResponse.json({ ok: true, slug: shop.slug });
  res.cookies.set(IMPERSONATE_COOKIE, shop.id, {
    httpOnly: true,
    sameSite: "lax",
    path:     "/",
    // No maxAge = session cookie — clears when browser closes
  });
  return res;
}

// DELETE /api/admin/impersonate — stop impersonating
export async function DELETE(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(IMPERSONATE_COOKIE);
  return res;
}
