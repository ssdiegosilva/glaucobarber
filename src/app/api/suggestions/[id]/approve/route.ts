import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyWhatsappQueued } from "@/lib/notifications";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.barbershopId || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const suggestion = await prisma.suggestion.findUnique({ where: { id } });
  if (!suggestion || suggestion.barbershopId !== session.user.barbershopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.suggestion.update({ where: { id }, data: { status: "APPROVED" } });

  const action = await prisma.action.create({
    data: {
      barbershopId: suggestion.barbershopId,
      suggestionId: suggestion.id,
      title:        suggestion.title,
      description:  suggestion.content,
      type:         suggestion.type,
      status:       "APPROVED",
      source:       "ai",
      createdBy:    session.user.id,
      approvedBy:   session.user.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      barbershopId: suggestion.barbershopId,
      userId:       session.user.id,
      action:       "suggestion.approved",
      entity:       "Suggestion",
      entityId:     suggestion.id,
      metadata:     JSON.stringify({ actionId: action.id }),
    },
  });

  // For CLIENT_MESSAGE: auto-queue WhatsApp message scheduled 30 min from now
  let whatsappQueued = false;
  if (suggestion.type === "CLIENT_MESSAGE" && suggestion.context) {
    try {
      const ctx = JSON.parse(suggestion.context);
      const clients: Array<{ name: string; phone?: string | null }> =
        ctx.clientsAtRisk ?? ctx.clientsInactive ?? ctx.clientsReactivated ?? [];
      const client = clients.find((c) => c.phone);
      if (client?.phone) {
        const scheduledFor = new Date(Date.now() + 30 * 60 * 1000);
        await prisma.whatsappMessage.create({
          data: {
            barbershopId: suggestion.barbershopId,
            customerName: client.name,
            phone:        client.phone,
            message:      suggestion.content,
            type:         "reactivation",
            status:       "QUEUED",
            scheduledFor,
          },
        });
        whatsappQueued = true;
        await notifyWhatsappQueued(suggestion.barbershopId, 1, client.name);
      }
    } catch {
      // context parse failed — skip queuing silently
    }
  }

  return NextResponse.json({ ok: true, actionId: action.id, whatsappQueued });
}
