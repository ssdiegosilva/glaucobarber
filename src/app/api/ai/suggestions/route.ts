import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAIProvider, buildAIContext, saveAISuggestions } from "@/lib/ai/provider";
import { prisma } from "@/lib/prisma";
import { checkAiAllowance, consumeAiCredit } from "@/lib/billing";
import { startOfDay } from "date-fns";

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.barbershopId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const barbershopId = session.user.barbershopId;
  const body = await req.json().catch(() => ({}));
  const isGift = body?.gift === true;

  // If gift requested, verify it's actually the first generation today (server-side check)
  let giftApplied = false;
  if (isGift) {
    const shop = await prisma.barbershop.findUnique({
      where:  { id: barbershopId },
      select: { lastDailyGiftAt: true },
    });
    const todayStart = startOfDay(new Date());
    const alreadyUsed = shop?.lastDailyGiftAt && shop.lastDailyGiftAt >= todayStart;
    if (!alreadyUsed) giftApplied = true;
  }

  // Only check/consume credits for non-gift calls
  if (!giftApplied) {
    const { allowed } = await checkAiAllowance(barbershopId);
    if (!allowed) return NextResponse.json({ error: "ai_limit_reached", message: "Limite de IA atingido. Adicione créditos para continuar.", upgradeUrl: "/billing" }, { status: 402 });
  }

  try {
    const context     = await buildAIContext(barbershopId);
    const provider    = getAIProvider();
    const suggestions = await provider.generateSuggestions(context);

    await saveAISuggestions(barbershopId, suggestions, context);

    if (giftApplied) {
      // Mark daily gift as used — no credit deducted
      await prisma.barbershop.update({
        where: { id: barbershopId },
        data:  { lastDailyGiftAt: new Date() },
      });
    } else {
      await consumeAiCredit(barbershopId, "ai_suggestion");
    }

    await prisma.auditLog.create({
      data: {
        barbershopId,
        userId:   session.user.id,
        action:   "ai.suggestions.generated",
        entity:   "Suggestion",
        metadata: JSON.stringify({ count: suggestions.length, provider: provider.name, gift: giftApplied }),
      },
    });

    return NextResponse.json({ suggestions, count: suggestions.length, gift: giftApplied });
  } catch (err) {
    console.error(`[ai/suggestions] error for ${barbershopId}:`, err);
    await prisma.auditLog.create({
      data: {
        barbershopId,
        userId:   session.user.id,
        action:   "ai.suggestions.error",
        entity:   "Suggestion",
        metadata: JSON.stringify({ error: String(err) }),
      },
    }).catch(() => {});
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
