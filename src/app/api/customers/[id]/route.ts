import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { name, phone, email, notes, doNotContact, tags, status } = await req.json();

  const customer = await prisma.customer.findFirst({
    where: { id, barbershopId: session.user.barbershopId },
  });
  if (!customer) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  const updated = await prisma.customer.update({
    where: { id },
    data: {
      ...(name          != null ? { name }                               : {}),
      ...(phone         !== undefined ? { phone: phone ?? null }         : {}),
      ...(email         !== undefined ? { email: email ?? null }         : {}),
      ...(notes         !== undefined ? { notes: notes ?? null }         : {}),
      ...(doNotContact  != null ? { doNotContact: Boolean(doNotContact) }: {}),
      ...(tags          != null ? { tags }                               : {}),
      ...(status        != null ? { status }                             : {}),
      locallyModifiedAt: new Date(),
    },
    select: { id: true, name: true, phone: true, email: true, notes: true, doNotContact: true, tags: true },
  });

  return NextResponse.json({ customer: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const customer = await prisma.customer.findFirst({
    where: { id, barbershopId: session.user.barbershopId },
  });
  if (!customer) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  await prisma.customer.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
