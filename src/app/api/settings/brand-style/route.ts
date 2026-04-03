import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { brandStyle } = (await req.json()) as { brandStyle?: string };

  const updated = await prisma.barbershop.update({
    where: { id: session.user.barbershopId },
    data:  { brandStyle: brandStyle?.trim() || null },
    select: { brandStyle: true },
  });

  return NextResponse.json({ barbershop: updated });
}
