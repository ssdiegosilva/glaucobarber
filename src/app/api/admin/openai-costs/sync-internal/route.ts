import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const FEATURE_LABEL: Record<string, string> = {
  campaign_image: "Imagem campanha (interno)",
  campaign_text:  "Texto campanha (interno)",
  copilot_chat:   "Copilot chat (interno)",
  theme_suggest:  "Sugestão de tema (interno)",
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  let yearMonths: string[] = body.yearMonths;
  if (!yearMonths?.length) {
    const now = new Date();
    yearMonths = [-2, -1, 0].map((offset) => {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
  }

  const synced: string[] = [];

  for (const yearMonth of yearMonths) {
    const [year, month] = yearMonth.split("-").map(Number);
    const start = new Date(year, month - 1, 1);
    const end   = new Date(year, month,     1);

    // Aggregate AiCallLog by feature for this month
    const logs = await prisma.aiCallLog.groupBy({
      by:    ["feature"],
      where: { createdAt: { gte: start, lt: end } },
      _count: { _all: true },
      _sum:   { costUsdCents: true },
    });

    for (const row of logs) {
      const nRequests = row._count._all;
      const costUsd   = (row._sum.costUsdCents ?? 0) / 100;
      const model     = `internal:${row.feature}`;
      const label     = FEATURE_LABEL[row.feature] ?? `${row.feature} (interno)`;

      // Ensure a price row exists so the display works
      await prisma.aiModelPrice.upsert({
        where:  { model },
        create: { model, displayName: label, inputPricePer1mTokens: 0, outputPricePer1mTokens: 0 },
        update: { displayName: label },
      });

      await prisma.aiUsageSnapshot.upsert({
        where:  { yearMonth_model: { yearMonth, model } },
        create: { yearMonth, model, nRequests, inputTokens: BigInt(0), outputTokens: BigInt(0), costUsd, syncedAt: new Date() },
        update: { nRequests, costUsd, syncedAt: new Date() },
      });
    }

    synced.push(yearMonth);
  }

  return NextResponse.json({ ok: true, synced, syncedAt: new Date().toISOString() });
}
