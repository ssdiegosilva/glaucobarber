import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.barbershopId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const threads = await prisma.copilotThread.findMany({
    where: { barbershopId: session.user.barbershopId },
    orderBy: { lastMessageAt: "desc" },
  });

  return NextResponse.json({ threads });
}
