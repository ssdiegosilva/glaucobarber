import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.isAdmin) return null;
  return session;
}

// PATCH /api/admin/whatsapp-templates/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();

  const tpl = await prisma.whatsappTemplate.update({
    where: { id },
    data: {
      ...(body.label     !== undefined && { label:     body.label }),
      ...(body.body      !== undefined && { body:      body.body }),
      ...(body.variables !== undefined && { variables: body.variables }),
      ...(body.metaName  !== undefined && { metaName:  body.metaName }),
      ...(body.active    !== undefined && { active:    body.active }),
    },
  });
  return NextResponse.json(tpl);
}

// DELETE /api/admin/whatsapp-templates/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  await prisma.whatsappTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
