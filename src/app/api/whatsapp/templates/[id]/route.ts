import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getOwned(id: string, barbershopId: string) {
  const t = await prisma.whatsappTemplate.findUnique({ where: { id } });
  if (!t || t.barbershopId !== barbershopId) return null;
  return t;
}

// PATCH — edit label, body, variables or toggle active
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const owned = await getOwned(id, session.user.barbershopId);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { label, body, variables, active } = await req.json();
  const updated = await prisma.whatsappTemplate.update({
    where: { id },
    data: {
      ...(label     !== undefined && { label }),
      ...(body      !== undefined && { body }),
      ...(variables !== undefined && { variables }),
      ...(active    !== undefined && { active }),
    },
  });
  return NextResponse.json(updated);
}

// DELETE — remove template
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const owned = await getOwned(id, session.user.barbershopId);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.whatsappTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
