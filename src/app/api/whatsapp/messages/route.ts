import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay, subDays } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const tab = searchParams.get("tab") ?? "today"; // today | queue | history

  const barbershopId = session.user.barbershopId;
  const now = new Date();

  if (tab === "today") {
    const messages = await prisma.whatsappMessage.findMany({
      where: { barbershopId, createdAt: { gte: startOfDay(now), lte: endOfDay(now) } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ messages });
  }

  if (tab === "queue") {
    const messages = await prisma.whatsappMessage.findMany({
      where: { barbershopId, status: "QUEUED" },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ messages });
  }

  // history: last 30 days, SENT only
  const messages = await prisma.whatsappMessage.findMany({
    where: {
      barbershopId,
      status: "SENT",
      sentAt: { gte: subDays(now, 30) },
    },
    orderBy: { sentAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ messages });
}
