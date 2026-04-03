import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/whatsapp/messages/[id]
// Body may contain: status, message (text), scheduledFor (ISO string | null)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { status, message, scheduledFor, sentManually } = body;

  if (status && !["SENT", "FAILED", "QUEUED"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const msg = await prisma.whatsappMessage.findUnique({ where: { id } });
  if (!msg || msg.barbershopId !== session.user.barbershopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.whatsappMessage.update({
    where: { id },
    data: {
      ...(status && { status, sentAt: status === "SENT" ? new Date() : undefined }),
      ...(message !== undefined && { message }),
      ...(scheduledFor !== undefined && {
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      }),
      ...(sentManually !== undefined && { sentManually: !!sentManually }),
    },
  });

  return NextResponse.json({ message: updated });
}

// DELETE /api/whatsapp/messages/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const msg = await prisma.whatsappMessage.findUnique({ where: { id } });
  if (!msg || msg.barbershopId !== session.user.barbershopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.whatsappMessage.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
