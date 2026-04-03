import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.barbershopId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const logs = await prisma.aiCallLog.findMany({
    where:   { barbershopId: session.user.barbershopId },
    orderBy: { createdAt: "desc" },
    take:    30,
    select:  { id: true, feature: true, label: true, createdAt: true },
  });

  return NextResponse.json({ logs });
}
