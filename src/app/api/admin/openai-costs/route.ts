import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const view = searchParams.get("view") ?? "month"; // "month" | "year"

  let snapshots;

  if (view === "year") {
    const year = searchParams.get("year") ?? String(new Date().getFullYear());
    // All months in this year
    const yearMonths = Array.from({ length: 12 }, (_, i) =>
      `${year}-${String(i + 1).padStart(2, "0")}`,
    );
    snapshots = await prisma.aiUsageSnapshot.findMany({
      where: { yearMonth: { in: yearMonths } },
      orderBy: [{ yearMonth: "asc" }, { costUsd: "desc" }],
    });
  } else {
    const now = new Date();
    const yearMonth =
      searchParams.get("yearMonth") ??
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    snapshots = await prisma.aiUsageSnapshot.findMany({
      where: { yearMonth },
      orderBy: { costUsd: "desc" },
    });
  }

  // Fetch prices for display
  const prices = await prisma.aiModelPrice.findMany();
  const priceMap = Object.fromEntries(prices.map((p) => [p.model, p]));

  // BigInt → string for JSON serialization
  const rows = snapshots.map((s) => ({
    yearMonth:    s.yearMonth,
    model:        s.model,
    displayName:  priceMap[s.model]?.displayName ?? s.model,
    nRequests:    s.nRequests,
    inputTokens:  s.inputTokens.toString(),
    outputTokens: s.outputTokens.toString(),
    costUsd:      s.costUsd,
    syncedAt:     s.syncedAt.toISOString(),
    price: priceMap[s.model]
      ? {
          inputPer1M:  priceMap[s.model].inputPricePer1mTokens,
          outputPer1M: priceMap[s.model].outputPricePer1mTokens,
          imageCents:  priceMap[s.model].imagePriceCents,
        }
      : null,
  }));

  // Last sync time across all returned rows
  const lastSyncedAt = snapshots.length > 0
    ? snapshots.reduce((max, s) => s.syncedAt > max ? s.syncedAt : max, snapshots[0].syncedAt).toISOString()
    : null;

  return NextResponse.json({ rows, lastSyncedAt });
}
