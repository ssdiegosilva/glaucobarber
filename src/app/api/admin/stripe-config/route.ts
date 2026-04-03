import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const CONFIG_KEYS = [
  "stripe_price_starter_monthly",
  "stripe_price_pro_monthly",
  "stripe_price_enterprise_monthly",
  "stripe_price_ai_credits_pack",
  "stripe_price_pro_metered",
  "pro_appointment_fee_cents",
  "pro_appointment_fee_cap_cents",
] as const;

export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await prisma.platformConfig.findMany({
    where: { key: { in: [...CONFIG_KEYS] } },
  });

  const result: Record<string, string> = {};
  for (const key of CONFIG_KEYS) {
    result[key] = rows.find((r) => r.key === key)?.value ?? "";
  }

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();

  for (const key of CONFIG_KEYS) {
    if (body[key] !== undefined) {
      await prisma.platformConfig.upsert({
        where:  { key },
        update: { value: String(body[key]) },
        create: { key,   value: String(body[key]) },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
