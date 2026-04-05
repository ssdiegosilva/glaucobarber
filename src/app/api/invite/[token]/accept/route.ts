import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST — accept invite: clear the token so it can't be reused
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const membership = await prisma.membership.findUnique({
    where: { inviteToken: token },
    select: { id: true },
  });

  if (!membership) {
    return NextResponse.json(
      { error: "Convite não encontrado ou já utilizado." },
      { status: 404 }
    );
  }

  // Clear invite token — invite consumed
  await prisma.membership.update({
    where: { id: membership.id },
    data:  { inviteToken: null },
  });

  return NextResponse.json({ ok: true });
}
