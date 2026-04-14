import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { seedSegments } from "@/../prisma/seed-segments";

// POST /api/admin/segments/seed — seeds the 5 default segments (idempotent)
export async function POST() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await seedSegments();
  return NextResponse.json({ ok: true, ...result });
}
