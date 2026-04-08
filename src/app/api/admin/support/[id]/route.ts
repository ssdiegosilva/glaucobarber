import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.supportMessage.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Mensagem não encontrada" }, { status: 404 });

  await prisma.supportMessage.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
