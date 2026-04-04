import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.barbershopId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const notifications = await prisma.systemNotification.findMany({
    where:   { barbershopId: session.user.barbershopId, dismissed: false },
    orderBy: { createdAt: "desc" },
    take:    20,
    select:  { id: true, type: true, title: true, body: true, link: true, createdAt: true },
  });

  return NextResponse.json({ notifications, count: notifications.length });
}
