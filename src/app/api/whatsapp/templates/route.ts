import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — list all templates for the barbershop (including inactive)
export async function GET() {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const templates = await prisma.whatsappTemplate.findMany({
    where:   { barbershopId: session.user.barbershopId },
    orderBy: { label: "asc" },
  });

  return NextResponse.json(templates);
}

// POST — create a new template
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { metaName, label, body, variables } = await req.json();
  if (!metaName || !label || !body) return NextResponse.json({ error: "metaName, label e body são obrigatórios" }, { status: 400 });

  const template = await prisma.whatsappTemplate.upsert({
    where:  { barbershopId_metaName: { barbershopId: session.user.barbershopId, metaName } },
    create: { barbershopId: session.user.barbershopId, metaName, label, body, variables: variables ?? "[]", active: true },
    update: { label, body, variables: variables ?? "[]", active: true },
  });

  return NextResponse.json(template, { status: 201 });
}
