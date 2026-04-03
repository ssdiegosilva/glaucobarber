import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAIProvider } from "@/lib/ai/provider";
import { checkAiAllowance, consumeAiCredit } from "@/lib/billing";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rawStyle } = (await req.json()) as { rawStyle?: string };
  if (!rawStyle?.trim()) return NextResponse.json({ error: "rawStyle is required" }, { status: 400 });

  const { allowed } = await checkAiAllowance(session.user.barbershopId);
  if (!allowed) return NextResponse.json({ error: "ai_limit_reached", message: "Limite de IA atingido.", upgradeUrl: "/billing" }, { status: 402 });

  const ai = getAIProvider();
  const brandStyle = await ai.improveBrandStyle(rawStyle.trim());

  await consumeAiCredit(session.user.barbershopId, "brand_style_improve");

  return NextResponse.json({ brandStyle });
}
