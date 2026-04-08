import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { reply } = await req.json();

  if (!reply || typeof reply !== "string" || reply.trim().length === 0) {
    return NextResponse.json({ error: "Resposta não pode ser vazia" }, { status: 400 });
  }

  const message = await prisma.supportMessage.findUnique({ where: { id } });
  if (!message) return NextResponse.json({ error: "Mensagem não encontrada" }, { status: 404 });

  await prisma.supportMessage.update({
    where: { id },
    data: {
      adminReply:  reply.trim(),
      status:      "REPLIED",
      repliedAt:   new Date(),
      readByAdmin: true,
    },
  });

  // Notifica o usuário no sino
  await prisma.systemNotification.create({
    data: {
      barbershopId: message.barbershopId,
      type:         "SUPPORT_REPLY",
      title:        "Nova resposta do suporte",
      body:         "O administrador respondeu sua mensagem. Clique para ver.",
      link:         "/support",
    },
  });

  return NextResponse.json({ ok: true });
}
