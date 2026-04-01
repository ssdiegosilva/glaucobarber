import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const services = await prisma.service.findMany({
    where:   { barbershopId: session.user.barbershopId, active: true },
    select:  { id: true, name: true, price: true, durationMin: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ services: services.map((s) => ({ ...s, price: Number(s.price) })) });
}
