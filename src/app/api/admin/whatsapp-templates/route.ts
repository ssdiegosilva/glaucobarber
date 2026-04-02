import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.isAdmin) return null;
  return session;
}

// GET /api/admin/whatsapp-templates?barbershopId=xxx
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const barbershopId = req.nextUrl.searchParams.get("barbershopId");
  if (!barbershopId) return NextResponse.json({ error: "barbershopId required" }, { status: 400 });

  const templates = await prisma.whatsappTemplate.findMany({
    where: { barbershopId },
    orderBy: { label: "asc" },
  });
  return NextResponse.json(templates);
}

// POST /api/admin/whatsapp-templates — create
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { barbershopId, metaName, label, body, variables } = await req.json();
  if (!barbershopId || !metaName || !label || !body) {
    return NextResponse.json({ error: "barbershopId, metaName, label, body required" }, { status: 400 });
  }

  const tpl = await prisma.whatsappTemplate.upsert({
    where:  { barbershopId_metaName: { barbershopId, metaName } },
    update: { label, body, variables: variables ?? "[]", active: true },
    create: { barbershopId, metaName, label, body, variables: variables ?? "[]" },
  });
  return NextResponse.json(tpl, { status: 201 });
}
