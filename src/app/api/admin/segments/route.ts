import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/segments — list all segments with aiConfig and barbershop count
export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const segments = await prisma.segment.findMany({
    include: {
      aiConfig: true,
      _count: { select: { barbershops: true } },
    },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(segments);
}

// POST /api/admin/segments — create a new segment
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    key,
    displayName,
    tenantLabel,
    description,
    icon,
    colorPrimary,
    availableModules,
    serviceCategories,
    roles,
    sortOrder,
    aiConfig,
  } = body;

  if (!key || !displayName || !tenantLabel) {
    return NextResponse.json(
      { error: "key, displayName and tenantLabel are required" },
      { status: 400 }
    );
  }

  const existing = await prisma.segment.findUnique({ where: { key } });
  if (existing) {
    return NextResponse.json({ error: "Já existe um segmento com esta chave (key)." }, { status: 409 });
  }

  const segment = await prisma.segment.create({
    data: {
      key,
      displayName,
      tenantLabel,
      description,
      icon,
      colorPrimary: colorPrimary ?? "220 60% 55%",
      availableModules: availableModules ? JSON.stringify(availableModules) : "[]",
      serviceCategories: serviceCategories ? JSON.stringify(serviceCategories) : "[]",
      roles: roles ? JSON.stringify(roles) : "[]",
      sortOrder: sortOrder ?? 99,
      ...(aiConfig && {
        aiConfig: {
          create: {
            copilotSystemPrompt: aiConfig.copilotSystemPrompt ?? "",
            suggestionsSystemPrompt: aiConfig.suggestionsSystemPrompt ?? "",
            campaignTextSystemPrompt: aiConfig.campaignTextSystemPrompt ?? "",
            brandStyleSystemPrompt: aiConfig.brandStyleSystemPrompt ?? "",
            serviceAnalysisSystemPrompt: aiConfig.serviceAnalysisSystemPrompt ?? "",
            vitrineCaptionSystemPrompt: aiConfig.vitrineCaptionSystemPrompt ?? "",
            haircutVisualPrompt: aiConfig.haircutVisualPrompt ?? "",
            featureCosts: JSON.stringify(aiConfig.featureCosts ?? {}),
            imageFeatures: JSON.stringify(aiConfig.imageFeatures ?? []),
          },
        },
      }),
    },
    include: { aiConfig: true },
  });

  return NextResponse.json(segment, { status: 201 });
}
