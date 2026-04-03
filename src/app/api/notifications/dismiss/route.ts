import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  // Only allow dismissing own barbershop's notifications
  await prisma.systemNotification.updateMany({
    where: { id, barbershopId: session.user.barbershopId },
    data:  { dismissed: true },
  });

  return NextResponse.json({ ok: true });
}
