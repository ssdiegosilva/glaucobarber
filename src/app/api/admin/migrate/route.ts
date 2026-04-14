import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/admin/migrate — run pending one-shot schema migrations
// Admin-only. Safe to call multiple times (all operations are idempotent).
export async function POST() {
  const session = await auth();
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const results: string[] = [];

  try {
    // Migration 001: add colorBackground + colorCard to segments table
    await prisma.$executeRawUnsafe(`
      ALTER TABLE segments
        ADD COLUMN IF NOT EXISTS "colorBackground" TEXT NOT NULL DEFAULT '240 11% 7%',
        ADD COLUMN IF NOT EXISTS "colorCard"       TEXT NOT NULL DEFAULT '240 10% 11%'
    `);
    results.push("001: segments.colorBackground + colorCard — ok");
  } catch (e) {
    results.push(`001: segments colors — error: ${e instanceof Error ? e.message : String(e)}`);
  }

  return NextResponse.json({ ok: true, results });
}
