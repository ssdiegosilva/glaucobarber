import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/targeted-offers/[id]?page=1&limit=10
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const page  = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "10", 10));
  const skip  = (page - 1) * limit;

  const offer = await prisma.targetedOffer.findFirst({
    where: { id, barbershopId: session.user.barbershopId },
  });
  if (!offer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [customers, total] = await Promise.all([
    prisma.targetedOfferCustomer.findMany({
      where: { targetedOfferId: id },
      orderBy: { createdAt: "asc" },
      skip,
      take: limit,
    }),
    prisma.targetedOfferCustomer.count({ where: { targetedOfferId: id } }),
  ]);

  // Fetch WhatsApp message statuses for customers that have a whatsappMsgId
  const msgIds = customers.map((c) => c.whatsappMsgId).filter(Boolean) as string[];
  const whatsappMsgs = msgIds.length > 0
    ? await prisma.whatsappMessage.findMany({
        where: { id: { in: msgIds } },
        select: { id: true, status: true, sentAt: true },
      })
    : [];

  const statusMap = Object.fromEntries(whatsappMsgs.map((m) => [m.id, m]));

  const enrichedCustomers = customers.map((c: typeof customers[number]) => ({
    ...c,
    whatsappStatus: c.whatsappMsgId ? (statusMap[c.whatsappMsgId]?.status ?? null) : null,
    sentAt: c.whatsappMsgId ? (statusMap[c.whatsappMsgId]?.sentAt?.toISOString() ?? null) : null,
  }));

  return NextResponse.json({
    offer,
    customers: enrichedCustomers,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}
