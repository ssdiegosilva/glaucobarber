import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/campaigns/[id]/republish
// Duplicates a campaign (ARCHIVED or PUBLISHED) as a new DRAFT for re-approval.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const original = await prisma.campaign.findFirst({
    where: { id, barbershopId: session.user.barbershopId },
  });
  if (!original) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!["ARCHIVED", "PUBLISHED", "DISMISSED"].includes(original.status)) {
    return NextResponse.json({ error: "Apenas campanhas arquivadas ou publicadas podem ser republicadas" }, { status: 400 });
  }

  const newCampaign = await prisma.campaign.create({
    data: {
      barbershopId: original.barbershopId,
      title:        `${original.title} (cópia)`,
      objective:    original.objective,
      text:         original.text,
      artBriefing:  original.artBriefing,
      channel:      original.channel,
      imageUrl:     original.imageUrl,  // reuse existing image
      status:       "DRAFT",
    },
  });

  return NextResponse.json({
    campaign: {
      ...newCampaign,
      createdAt:   newCampaign.createdAt.toISOString(),
      publishedAt: null,
      scheduledAt: null,
      instagramPermalink: null,
      suggestion: null,
    },
  });
}
