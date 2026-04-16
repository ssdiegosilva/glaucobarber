import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET — validate invite token and return info for the invite page
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const membership = await prisma.membership.findUnique({
    where: { inviteToken: token },
    include: {
      user:       { select: { name: true, email: true } },
      barbershop: { select: { name: true } },
    },
  });

  if (!membership) {
    return NextResponse.json(
      { error: "Convite não encontrado ou já utilizado." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    email:          membership.user.email,
    name:           membership.user.name ?? "Membro",
    barbershopName: membership.barbershop.name,
    role:           membership.role,
    hasAccount:     true, // simplified — signup flow handles account creation
  });
}
