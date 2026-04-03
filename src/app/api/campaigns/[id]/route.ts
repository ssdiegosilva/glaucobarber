import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id, barbershopId: session.user.barbershopId },
    });
    if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (campaign.status === "PUBLISHED") return NextResponse.json({ error: "Não é possível excluir publicada" }, { status: 400 });

    await prisma.campaign.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Erro ao deletar campanha", err);
    return NextResponse.json({ error: "Erro ao deletar campanha" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { status, imageUrl, templateId, scheduledAt } = await req.json();

  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign || campaign.barbershopId !== session.user.barbershopId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: any = {};
  if (status) {
    const allowed = ["DRAFT", "APPROVED", "DISMISSED", "SCHEDULED"];
    if (!allowed.includes(status)) return NextResponse.json({ error: "Status inválido" }, { status: 400 });
    data.status = status;
  }
  if (imageUrl    !== undefined) data.imageUrl   = imageUrl   || null;
  if (templateId  !== undefined) data.templateId = templateId || null;
  if (scheduledAt !== undefined) data.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });

  await prisma.campaign.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}
