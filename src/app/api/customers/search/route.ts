import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ customers: [] });

  const customers = await prisma.customer.findMany({
    where: {
      barbershopId: session.user.barbershopId,
      deletedAt: null,
      OR: [
        { name:  { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ],
    },
    select: {
      id:    true,
      name:  true,
      phone: true,
      postSaleStatus: true,
      totalVisits:    true,
    },
    orderBy: { name: "asc" },
    take: 15,
  });

  return NextResponse.json({ customers });
}
