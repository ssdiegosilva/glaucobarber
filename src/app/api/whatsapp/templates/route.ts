import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — list templates for the barbershop
// ?kind=meta|text  (omit for all)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const kind = req.nextUrl.searchParams.get("kind");

  const templates = await prisma.whatsappTemplate.findMany({
    where: {
      barbershopId: session.user.barbershopId,
      ...(kind ? { kind } : {}),
    },
    orderBy: { label: "asc" },
  });

  return NextResponse.json(templates);
}

// POST — create a new template
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const barbershopId = session.user.barbershopId;
  const { metaName, label, body, variables, kind = "meta" } = await req.json();

  if (!label || !body) return NextResponse.json({ error: "label e body são obrigatórios" }, { status: 400 });

  // For "text" kind, auto-generate metaName from label if not provided
  const resolvedMetaName = metaName?.trim() ||
    `text_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}_${Date.now()}`;

  if (kind === "meta" && !metaName?.trim()) {
    return NextResponse.json({ error: "metaName é obrigatório para templates Meta" }, { status: 400 });
  }

  const template = await prisma.whatsappTemplate.upsert({
    where:  { barbershopId_metaName: { barbershopId, metaName: resolvedMetaName } },
    create: { barbershopId, metaName: resolvedMetaName, label, body, variables: variables ?? "[]", active: true, kind },
    update: { label, body, variables: variables ?? "[]", active: true },
  });

  return NextResponse.json(template, { status: 201 });
}
