import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/lib/ai/provider";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { theme, objective, templateId, channel } = await req.json();
  if (!theme || !objective) return NextResponse.json({ error: "Tema e objetivo são obrigatórios" }, { status: 400 });

  const provider = getAIProvider();
  const context = `Barbearia: ${session.user.barbershopId}. Tema: ${theme}. Objetivo: ${objective}.`;
  const ai = await provider.generateCampaignText(objective, context);

  const campaign = await prisma.campaign.create({
    data: {
      barbershopId: session.user.barbershopId,
      status: "DRAFT",
      title: theme,
      objective,
      text: ai.text || "",
      artBriefing: ai.artBriefing || "",
      channel: channel ?? "instagram",
      templateId: templateId ?? null,
    },
  });

  return NextResponse.json({ campaign, ai });
}
