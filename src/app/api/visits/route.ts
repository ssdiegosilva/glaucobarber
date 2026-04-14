import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { refreshPostSaleStatus, refreshCustomer60dStats } from "@/modules/post-sale/service";

// ── POST /api/visits ─────────────────────────────────────────
// Creates a visit record and updates customer post-sale stats.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const barbershopId = session.user.barbershopId;
  const body = await req.json() as {
    customerId?: string;
    customerName?: string;
    phone?: string;
    amount?: number | string;
    notes?: string;
    visitedAt?: string;
    source?: string;
  };

  // Resolve customerId: use provided, or look up / create by phone
  let customerId: string | null = body.customerId ?? null;

  if (!customerId && body.phone) {
    const phone = body.phone.replace(/\D/g, "");
    let customer = await prisma.customer.findFirst({
      where: { barbershopId, phone: { contains: phone.slice(-8) } },
      select: { id: true },
    });
    if (!customer && body.customerName) {
      customer = await prisma.customer.create({
        data: { barbershopId, name: body.customerName, phone: body.phone },
        select: { id: true },
      });
    }
    customerId = customer?.id ?? null;
  }

  const amount = body.amount != null ? Number(body.amount) : null;
  const visitedAt = body.visitedAt ? new Date(body.visitedAt) : new Date();

  const visit = await prisma.visit.create({
    data: {
      barbershopId,
      customerId,
      amount: amount != null ? amount : undefined,
      notes: body.notes?.trim() || null,
      visitedAt,
      source: body.source ?? "manual",
    },
    include: { customer: { select: { id: true, name: true, phone: true, postSaleStatus: true } } },
  });

  // Update customer post-sale fields (fire-and-forget for speed)
  if (customerId) {
    prisma.customer.update({
      where: { id: customerId },
      data: {
        lastCompletedAppointmentAt: visitedAt,
        lastSpentAmount: amount != null ? amount : undefined,
        lastServiceSummary: body.notes?.trim() || null,
        lastVisitAt: visitedAt,
        totalVisits: { increment: 1 },
        totalSpent: amount != null ? { increment: amount } : undefined,
      },
    }).then(() => {
      refreshCustomer60dStats(customerId!).catch((err) =>
        console.error("[visits] refreshCustomer60dStats error:", err)
      );
      refreshPostSaleStatus(barbershopId).catch((err) =>
        console.error("[visits] refreshPostSaleStatus error:", err)
      );
    }).catch((err) => console.error("[visits] customer update error:", err));
  }

  return NextResponse.json({ visit });
}

// ── GET /api/visits ──────────────────────────────────────────
// Lists visits for the barbershop (today by default, or by date range).
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  // Default: today
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const gte = from ? new Date(from) : startOfDay;
  const lte = to   ? new Date(to)   : endOfDay;

  const visits = await prisma.visit.findMany({
    where: {
      barbershopId: session.user.barbershopId,
      visitedAt: { gte, lte },
    },
    include: {
      customer: { select: { id: true, name: true, phone: true, postSaleStatus: true } },
    },
    orderBy: { visitedAt: "desc" },
    take: 200,
  });

  // Summary stats for the period
  const totalAmount = visits.reduce((acc, v) => acc + Number(v.amount ?? 0), 0);

  return NextResponse.json({ visits, totalAmount, count: visits.length });
}
