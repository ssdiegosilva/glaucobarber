import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAIProvider, buildAIContext, saveAISuggestions } from "@/lib/ai/provider";
import { prisma } from "@/lib/prisma";
import { checkAiAllowance, consumeAiCredit } from "@/lib/billing";

export async function POST() {
  const session = await auth();

  if (!session?.user?.barbershopId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const barbershopId = session.user.barbershopId;

  const { allowed } = await checkAiAllowance(barbershopId);
  if (!allowed) return NextResponse.json({ error: "ai_limit_reached", message: "Limite de IA atingido. Adicione créditos para continuar.", upgradeUrl: "/billing" }, { status: 402 });

  try {
    const context     = await buildAIContext(barbershopId);
    const provider    = getAIProvider();
    const suggestions = await provider.generateSuggestions(context);

    await saveAISuggestions(barbershopId, suggestions, context);
    await consumeAiCredit(barbershopId);

    await prisma.auditLog.create({
      data: {
        barbershopId,
        userId:   session.user.id,
        action:   "ai.suggestions.generated",
        entity:   "Suggestion",
        metadata: JSON.stringify({ count: suggestions.length, provider: provider.name }),
      },
    });

    return NextResponse.json({ suggestions, count: suggestions.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
