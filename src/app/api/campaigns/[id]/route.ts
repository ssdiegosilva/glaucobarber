import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaign = await prisma.campaign.findUnique({ where: { id: params.id } });
  if (!campaign || campaign.barbershopId !== session.user.barbershopId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (campaign.status === "PUBLISHED") return NextResponse.json({ error: "Não é possível excluir publicada" }, { status: 400 });

  await prisma.campaign.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { status } = await req.json();
  if (!status) return NextResponse.json({ error: "Status requerido" }, { status: 400 });

  const campaign = await prisma.campaign.findUnique({ where: { id: params.id } });
  if (!campaign || campaign.barbershopId !== session.user.barbershopId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowed = ["DRAFT", "APPROVED", "DISMISSED", "SCHEDULED"];
  if (!allowed.includes(status)) return NextResponse.json({ error: "Status inválido" }, { status: 400 });

  await prisma.campaign.update({ where: { id: params.id }, data: { status } });
  return NextResponse.json({ ok: true });
}
