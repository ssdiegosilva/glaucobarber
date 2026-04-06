import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await prisma.platformConfig.findMany({ orderBy: { key: "asc" } });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { key, value } = await req.json();
  if (typeof key !== "string" || typeof value !== "string") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const row = await prisma.platformConfig.upsert({
    where:  { key },
    update: { value },
    create: { key, value },
  });

  return NextResponse.json(row);
}
