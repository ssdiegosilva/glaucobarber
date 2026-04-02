import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { address, city, state } = body;

  const updated = await prisma.barbershop.update({
    where: { id: session.user.barbershopId },
    data: {
      ...(address != null ? { address: String(address).trim() || null } : {}),
      ...(city    != null ? { city:    String(city).trim()    || null } : {}),
      ...(state   != null ? { state:   String(state).trim()   || null } : {}),
    },
    select: { address: true, city: true, state: true },
  });

  return NextResponse.json({ location: updated });
}
