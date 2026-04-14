import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/targeted-offers/preview?type=product&ids=id1,id2&days=30
// Returns customers who bought ANY of the listed items MORE THAN X days ago
// (last purchase of those items was over X days ago = re-engagement targets)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const barbershopId = session.user.barbershopId;
  const { searchParams } = new URL(req.url);

  const type = searchParams.get("type") as "product" | "service" | null;
  const idsRaw = searchParams.get("ids") ?? "";
  const daysRaw = searchParams.get("days") ?? "30";

  if (!type || !["product", "service"].includes(type)) {
    return NextResponse.json({ error: "type must be 'product' or 'service'" }, { status: 400 });
  }

  const ids = idsRaw.split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) return NextResponse.json({ count: 0, customers: [] });

  const days = Math.max(1, parseInt(daysRaw, 10) || 30);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  if (type === "product") {
    // Customers who bought any of the listed products, where their LAST purchase of those items was before cutoff
    const rows = await prisma.$queryRaw<
      { customerId: string; lastPurchase: Date }[]
    >`
      SELECT vi."visitId" as "visitId", v."customerId", MAX(v."visitedAt") as "lastPurchase"
      FROM "visit_items" vi
      JOIN "visits" v ON v.id = vi."visitId"
      WHERE v."barbershopId" = ${barbershopId}
        AND vi."productId" = ANY(${ids}::text[])
        AND v."customerId" IS NOT NULL
      GROUP BY vi."visitId", v."customerId"
      HAVING MAX(v."visitedAt") < ${cutoff}
    `;

    // Deduplicate by customerId (keep earliest lastPurchase per customer for display)
    const customerMap = new Map<string, Date>();
    for (const row of rows) {
      if (row.customerId) {
        const existing = customerMap.get(row.customerId);
        if (!existing || row.lastPurchase > existing) {
          customerMap.set(row.customerId, row.lastPurchase);
        }
      }
    }

    const customerIds = Array.from(customerMap.keys());
    if (customerIds.length === 0) return NextResponse.json({ count: 0, customers: [] });

    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds }, barbershopId, deletedAt: null },
      select: { id: true, name: true, phone: true },
      take: 100,
    });

    const enriched = customers
      .filter((c) => c.phone) // only customers with phone (needed for WhatsApp)
      .map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        lastPurchase: customerMap.get(c.id)?.toISOString() ?? null,
      }));

    return NextResponse.json({ count: enriched.length, customers: enriched });
  }

  // type === "service"
  const rows = await prisma.$queryRaw<
    { customerId: string; lastPurchase: Date }[]
  >`
    SELECT a."customerId", MAX(a."scheduledAt") as "lastPurchase"
    FROM "appointments" a
    WHERE a."barbershopId" = ${barbershopId}
      AND a."serviceId" = ANY(${ids}::text[])
      AND a."customerId" IS NOT NULL
      AND a."status" = 'COMPLETED'
    GROUP BY a."customerId"
    HAVING MAX(a."scheduledAt") < ${cutoff}
  `;

  const customerMap = new Map<string, Date>();
  for (const row of rows) {
    if (row.customerId) customerMap.set(row.customerId, row.lastPurchase);
  }

  const customerIds = Array.from(customerMap.keys());
  if (customerIds.length === 0) return NextResponse.json({ count: 0, customers: [] });

  const customers = await prisma.customer.findMany({
    where: { id: { in: customerIds }, barbershopId, deletedAt: null },
    select: { id: true, name: true, phone: true },
    take: 100,
  });

  const enriched = customers
    .filter((c) => c.phone)
    .map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      lastPurchase: customerMap.get(c.id)?.toISOString() ?? null,
    }));

  return NextResponse.json({ count: enriched.length, customers: enriched });
}
