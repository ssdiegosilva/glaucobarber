import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params; // membership id
  const { role, active } = await req.json();

  const membership = await prisma.membership.update({
    where: { id },
    data:  {
      ...(role   !== undefined ? { role }   : {}),
      ...(active !== undefined ? { active } : {}),
    },
  });

  return NextResponse.json({ ok: true, role: membership.role, active: membership.active });
}
