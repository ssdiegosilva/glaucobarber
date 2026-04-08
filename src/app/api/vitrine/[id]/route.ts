import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteVitrineFoto } from "@/lib/storage";
import { VitrinPostStatus } from "@prisma/client";

const ALLOWED_STATUS_UPDATES: VitrinPostStatus[] = ["DRAFT", "APPROVED", "DISMISSED", "SCHEDULED"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const post = await prisma.vitrinPost.findFirst({
    where: { id, barbershopId: session.user.barbershopId },
  });
  if (!post) return NextResponse.json({ error: "Post não encontrado" }, { status: 404 });

  const body = await req.json();
  const { caption, status, scheduledAt } = body as {
    caption?: string;
    status?: VitrinPostStatus;
    scheduledAt?: string | null;
  };

  if (status && !ALLOWED_STATUS_UPDATES.includes(status)) {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 });
  }

  const updated = await prisma.vitrinPost.update({
    where: { id },
    data: {
      ...(caption !== undefined ? { caption } : {}),
      ...(status ? { status } : {}),
      ...(scheduledAt !== undefined ? { scheduledAt: scheduledAt ? new Date(scheduledAt) : null } : {}),
    },
    include: { images: { orderBy: { position: "asc" } } },
  });

  return NextResponse.json({ post: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const post = await prisma.vitrinPost.findFirst({
    where: { id, barbershopId: session.user.barbershopId },
    include: { images: true },
  });
  if (!post) return NextResponse.json({ error: "Post não encontrado" }, { status: 404 });
  if (post.status === "PUBLISHED") {
    return NextResponse.json({ error: "Não é possível apagar um post já publicado" }, { status: 400 });
  }

  // Delete photos from storage
  await Promise.allSettled(post.images.map((img) => deleteVitrineFoto(img.path)));

  await prisma.vitrinPost.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
