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

  // Validate ID format to prevent SQL injection via $queryRaw
  const idRegex = /^[a-zA-Z0-9_-]+$/;
  if (ids.some((id) => !idRegex.test(id))) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const days = Math.max(1, parseInt(daysRaw, 10) || 30);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // ── "never bought" mode: return customers who never used these items
  const neverMode = searchParams.get("never") === "true";
  const searchQuery = searchParams.get("q")?.trim() ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = 30;
  const browse = searchParams.get("browse") === "true"; // paginated browsing mode

  if (neverMode) {
    // Find customer IDs who HAVE bought/used these items (to exclude them)
    let boughtIds: string[] = [];
    if (type === "product") {
      const rows = await prisma.$queryRaw<{ customerId: string }[]>`
        SELECT DISTINCT v."customerId"
        FROM "visit_items" vi
        JOIN "visits" v ON v.id = vi."visitId"
        WHERE v."barbershopId" = ${barbershopId}
          AND vi."productId" = ANY(${ids}::text[])
          AND v."customerId" IS NOT NULL
      `;
      boughtIds = rows.map((r) => r.customerId);
    } else {
      const rows = await prisma.$queryRaw<{ customerId: string }[]>`
        SELECT DISTINCT a."customerId"
        FROM "appointments" a
        WHERE a."barbershopId" = ${barbershopId}
          AND a."serviceId" = ANY(${ids}::text[])
          AND a."customerId" IS NOT NULL
          AND a."status" = 'COMPLETED'
      `;
      boughtIds = rows.map((r) => r.customerId);
    }

    const where: Record<string, unknown> = {
      barbershopId,
      deletedAt: null,
      phone: { not: null },
      ...(boughtIds.length > 0 ? { id: { notIn: boughtIds } } : {}),
      ...(searchQuery ? { name: { contains: searchQuery, mode: "insensitive" } } : {}),
    };

    const shouldReturn = searchQuery || browse;
    const [count, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        select: { id: true, name: true, phone: true, totalVisits: true },
        orderBy: [{ totalVisits: "desc" }, { name: "asc" }],
        take: shouldReturn ? pageSize : 0,
        skip: shouldReturn ? (page - 1) * pageSize : 0,
      }),
    ]);

    return NextResponse.json({
      count,
      page,
      pageSize,
      hasMore: page * pageSize < count,
      customers: customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone, totalVisits: c.totalVisits ?? 0, lastPurchase: null })),
    });
  }

  // ── Standard mode: bought > X days ago + neverBoughtCount ──

  if (type === "product") {
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

    const customerMap = new Map<string, Date>();
    for (const row of rows) {
      if (row.customerId) {
        const existing = customerMap.get(row.customerId);
        if (!existing || row.lastPurchase > existing) {
          customerMap.set(row.customerId, row.lastPurchase);
        }
      }
    }

    // Count customers who NEVER bought these products
    const allBoughtRows = await prisma.$queryRaw<{ customerId: string }[]>`
      SELECT DISTINCT v."customerId"
      FROM "visit_items" vi
      JOIN "visits" v ON v.id = vi."visitId"
      WHERE v."barbershopId" = ${barbershopId}
        AND vi."productId" = ANY(${ids}::text[])
        AND v."customerId" IS NOT NULL
    `;
    const allBoughtIds = new Set(allBoughtRows.map((r) => r.customerId));
    const neverBoughtCount = await prisma.customer.count({
      where: { barbershopId, deletedAt: null, phone: { not: null }, id: { notIn: [...allBoughtIds] } },
    });

    const customerIds = Array.from(customerMap.keys());

    const customers = customerIds.length > 0
      ? await prisma.customer.findMany({
          where: { id: { in: customerIds }, barbershopId, deletedAt: null },
          select: { id: true, name: true, phone: true },
          take: 100,
        })
      : [];

    const enriched = customers
      .filter((c) => c.phone)
      .map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        lastPurchase: customerMap.get(c.id)?.toISOString() ?? null,
      }));

    return NextResponse.json({ count: enriched.length, customers: enriched, neverBoughtCount });
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

  // Count customers who NEVER used these services
  const allUsedRows = await prisma.$queryRaw<{ customerId: string }[]>`
    SELECT DISTINCT a."customerId"
    FROM "appointments" a
    WHERE a."barbershopId" = ${barbershopId}
      AND a."serviceId" = ANY(${ids}::text[])
      AND a."customerId" IS NOT NULL
      AND a."status" = 'COMPLETED'
  `;
  const allUsedIds = new Set(allUsedRows.map((r) => r.customerId));
  const neverBoughtCount = await prisma.customer.count({
    where: { barbershopId, deletedAt: null, phone: { not: null }, id: { notIn: [...allUsedIds] } },
  });

  const customerIds = Array.from(customerMap.keys());

  const customers = customerIds.length > 0
    ? await prisma.customer.findMany({
        where: { id: { in: customerIds }, barbershopId, deletedAt: null },
        select: { id: true, name: true, phone: true },
        take: 100,
      })
    : [];

  const enriched = customers
    .filter((c) => c.phone)
    .map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      lastPurchase: customerMap.get(c.id)?.toISOString() ?? null,
    }));

  return NextResponse.json({ count: enriched.length, customers: enriched, neverBoughtCount });
}
