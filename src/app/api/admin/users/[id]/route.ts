import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  // Prevent self-deletion
  if (id === session.user.id) {
    return NextResponse.json({ error: "Não é possível apagar o próprio usuário" }, { status: 400 });
  }

  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
