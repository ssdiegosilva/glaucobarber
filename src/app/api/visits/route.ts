import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { refreshPostSaleStatus, refreshCustomer60dStats } from "@/modules/post-sale/service";

type VisitItemInput = {
  productId?: string;
  name: string;
  price: number;
  quantity?: number;
};

// ── POST /api/visits ─────────────────────────────────────────
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
    items?: VisitItemInput[];
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

  const visitedAt = body.visitedAt ? new Date(body.visitedAt) : new Date();
  const rawItems = body.items ?? [];

  // Resolve productIds for inline items (no productId = create in catalog)
  const resolvedItems: Array<{ productId: string; name: string; price: number; quantity: number }> = [];
  for (const item of rawItems) {
    const qty = item.quantity ?? 1;
    const price = Number(item.price);
    let productId = item.productId ?? null;

    if (!productId) {
      const created = await prisma.product.create({
        data: { barbershopId, name: item.name.trim(), price },
        select: { id: true },
      });
      productId = created.id;
    }
    resolvedItems.push({ productId, name: item.name.trim(), price, quantity: qty });
  }

  // Compute amount: from items if any, otherwise manual
  const amount =
    resolvedItems.length > 0
      ? resolvedItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
      : body.amount != null
        ? Number(body.amount)
        : null;

  const visit = await prisma.visit.create({
    data: {
      barbershopId,
      customerId,
      amount:    amount != null ? amount : undefined,
      notes:     body.notes?.trim() || null,
      visitedAt,
      source:    body.source ?? "manual",
      items: resolvedItems.length > 0
        ? { create: resolvedItems.map((i) => ({ productId: i.productId, name: i.name, price: i.price, quantity: i.quantity })) }
        : undefined,
    },
    include: {
      customer: { select: { id: true, name: true, phone: true, postSaleStatus: true } },
      items: { select: { id: true, name: true, price: true, quantity: true, productId: true } },
    },
  });

  // Update customer post-sale fields (fire-and-forget)
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

  return NextResponse.json({
    visit: {
      ...visit,
      amount: visit.amount != null ? Number(visit.amount) : null,
      items: visit.items.map((i) => ({ ...i, price: Number(i.price) })),
    },
  });
}

// ── GET /api/visits ──────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const gte = from ? new Date(from) : startOfDay;
  const lte = to   ? new Date(to)   : endOfDay;

  const visits = await prisma.visit.findMany({
    where: { barbershopId: session.user.barbershopId, visitedAt: { gte, lte } },
    include: {
      customer: { select: { id: true, name: true, phone: true, postSaleStatus: true } },
      items: { select: { id: true, name: true, price: true, quantity: true, productId: true } },
    },
    orderBy: { visitedAt: "desc" },
    take: 200,
  });

  const totalAmount = visits.reduce((acc, v) => acc + Number(v.amount ?? 0), 0);

  return NextResponse.json({
    visits: visits.map((v) => ({
      ...v,
      amount: v.amount != null ? Number(v.amount) : null,
      items: v.items.map((i) => ({ ...i, price: Number(i.price) })),
    })),
    totalAmount,
    count: visits.length,
  });
}
