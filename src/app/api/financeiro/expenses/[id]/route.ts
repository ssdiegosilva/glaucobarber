import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getOwnedExpense(id: string, barbershopId: string) {
  return prisma.expense.findFirst({ where: { id, barbershopId } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await getOwnedExpense(id, session.user.barbershopId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const updated = await prisma.expense.update({
    where: { id },
    data: {
      ...(body.label       !== undefined && { label:       String(body.label).trim() }),
      ...(body.amountCents !== undefined && { amountCents: Math.round(Number(body.amountCents)) }),
      ...(body.note        !== undefined && { note:        body.note ? String(body.note).trim() : null }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await getOwnedExpense(id, session.user.barbershopId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.expense.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
