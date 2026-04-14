import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── PATCH /api/products/[id] ─────────────────────────────────
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as { name?: string; price?: number | string; category?: string; description?: string; active?: boolean; imageUrl?: string | null };

  const existing = await prisma.product.findFirst({
    where: { id, barbershopId: session.user.barbershopId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.name !== undefined)        data.name        = body.name.trim();
  if (body.price !== undefined)       data.price       = Number(body.price);
  if (body.category !== undefined)    data.category    = body.category?.trim() || null;
  if (body.description !== undefined) data.description = body.description?.trim() || null;
  if (body.active !== undefined)      data.active      = Boolean(body.active);
  if (body.imageUrl !== undefined)    data.imageUrl    = body.imageUrl?.trim() || null;

  const product = await prisma.product.update({ where: { id }, data });
  return NextResponse.json({ product: { ...product, price: Number(product.price) } });
}

// ── DELETE /api/products/[id] ────────────────────────────────
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.product.findFirst({
    where: { id, barbershopId: session.user.barbershopId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.product.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
  return NextResponse.json({ ok: true });
}
