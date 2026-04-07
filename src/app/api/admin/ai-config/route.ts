import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const AI_CONFIG_KEYS = [
  "ai_image_model",
  "ai_image_quality",
  "ai_image_credit_cost",
  "ai_image_cost_usd_cents",
  "ai_image_credit_cost_low",
  "ai_image_credit_cost_medium",
  "ai_image_credit_cost_high",
] as const;

const AI_CONFIG_DEFAULTS: Record<string, string> = {
  ai_image_model:             "gpt-image-1",
  ai_image_quality:           "medium",
  ai_image_credit_cost:       "70",
  ai_image_cost_usd_cents:    "7",
  ai_image_credit_cost_low:   "40",
  ai_image_credit_cost_medium:"70",
  ai_image_credit_cost_high:  "190",
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await prisma.platformConfig.findMany({
    where: { key: { in: [...AI_CONFIG_KEYS] } },
  });

  const result: Record<string, string> = {};
  for (const key of AI_CONFIG_KEYS) {
    result[key] = rows.find((r) => r.key === key)?.value ?? AI_CONFIG_DEFAULTS[key] ?? "";
  }

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();

  for (const key of AI_CONFIG_KEYS) {
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
