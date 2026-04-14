import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invalidateSegmentCache } from "@/lib/core/segment";

// GET /api/admin/segments/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const segment = await prisma.segment.findUnique({
    where: { id },
    include: { aiConfig: true, _count: { select: { barbershops: true } } },
  });

  if (!segment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(segment);
}

// PATCH /api/admin/segments/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const {
    displayName,
    tenantLabel,
    description,
    icon,
    colorPrimary,
    colorBackground,
    colorCard,
    availableModules,
    serviceCategories,
    roles,
    sortOrder,
    active,
    aiConfig,
  } = body;

  const segmentData: Record<string, unknown> = {};
  if (displayName !== undefined) segmentData.displayName = displayName;
  if (tenantLabel !== undefined) segmentData.tenantLabel = tenantLabel;
  if (description !== undefined) segmentData.description = description;
  if (icon !== undefined) segmentData.icon = icon;
  if (colorPrimary    !== undefined) segmentData.colorPrimary    = colorPrimary;
  if (colorBackground !== undefined) segmentData.colorBackground = colorBackground;
  if (colorCard       !== undefined) segmentData.colorCard       = colorCard;
  if (availableModules !== undefined)
    segmentData.availableModules = typeof availableModules === "string"
      ? availableModules
      : JSON.stringify(availableModules);
  if (serviceCategories !== undefined)
    segmentData.serviceCategories = typeof serviceCategories === "string"
      ? serviceCategories
      : JSON.stringify(serviceCategories);
  if (roles !== undefined)
    segmentData.roles = typeof roles === "string" ? roles : JSON.stringify(roles);
  if (sortOrder !== undefined) segmentData.sortOrder = sortOrder;
  if (active !== undefined) segmentData.active = active;

  // If aiConfig fields are being updated, upsert them
  if (aiConfig) {
    const aiData: Record<string, unknown> = {};
    const aiFields = [
      "copilotSystemPrompt",
      "suggestionsSystemPrompt",
      "campaignTextSystemPrompt",
      "brandStyleSystemPrompt",
      "serviceAnalysisSystemPrompt",
      "vitrineCaptionSystemPrompt",
      "haircutVisualPrompt",
    ];
    for (const field of aiFields) {
      if (aiConfig[field] !== undefined) aiData[field] = aiConfig[field];
    }
    if (aiConfig.featureCosts !== undefined)
      aiData.featureCosts = typeof aiConfig.featureCosts === "string"
        ? aiConfig.featureCosts
        : JSON.stringify(aiConfig.featureCosts);
    if (aiConfig.imageFeatures !== undefined)
      aiData.imageFeatures = typeof aiConfig.imageFeatures === "string"
        ? aiConfig.imageFeatures
        : JSON.stringify(aiConfig.imageFeatures);

    segmentData.aiConfig = {
      upsert: {
        create: {
          copilotSystemPrompt: "",
          suggestionsSystemPrompt: "",
          campaignTextSystemPrompt: "",
          brandStyleSystemPrompt: "",
          serviceAnalysisSystemPrompt: "",
          vitrineCaptionSystemPrompt: "",
          haircutVisualPrompt: "",
          ...aiData,
        },
        update: aiData,
      },
    };

    // Invalidate cache so updated prompts take effect immediately
    await invalidateSegmentCache();
  }

  const segment = await prisma.segment.update({
    where: { id },
    data: segmentData,
    include: { aiConfig: true },
  });

  return NextResponse.json(segment);
}

// DELETE /api/admin/segments/[id] — soft delete (active = false)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const seg = await prisma.segment.findUnique({
    where: { id },
    select: { _count: { select: { barbershops: true } } },
  });

  if ((seg?._count.barbershops ?? 0) > 0) {
    return NextResponse.json(
      { error: "Não é possível desativar um segmento com estabelecimentos vinculados." },
      { status: 409 }
    );
  }

  await prisma.segment.update({
    where: { id },
    data: { active: false },
  });

  await invalidateSegmentCache();

  return NextResponse.json({ ok: true });
}
