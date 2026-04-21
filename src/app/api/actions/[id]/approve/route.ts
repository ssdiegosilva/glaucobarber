import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyWhatsappQueued } from "@/lib/notifications";

// Action types that enqueue a WhatsApp message on approval
const WHATSAPP_TYPES = new Set([
  "reactivation_promo",
  "post_sale_followup",
  "post_sale_review",
  "agenda_conflict",
  "product_promo",
]);

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.barbershopId || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const action = await prisma.action.findUnique({ where: { id } });
  if (!action || action.barbershopId !== session.user.barbershopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.action.update({
    where: { id },
    data: { status: "APPROVED", approvedBy: session.user.id },
  });

  // If this is a communication action, enqueue WhatsApp messages
  if (WHATSAPP_TYPES.has(action.type)) {
    const payload = (action.payload ?? {}) as Record<string, unknown>;

    // Normalize: support both array and single-client payloads
    const entries: Array<{ name: string; phone: string | null; message: string }> = [];

    const clientNames = payload.clientNames as string[] | undefined;
    const phones      = payload.phones      as string[] | undefined;
    const message     = (payload.message ?? payload.suggestedMessage ?? "") as string;

    if (Array.isArray(clientNames) && clientNames.length > 0) {
      clientNames.forEach((name, idx) => {
        entries.push({ name, phone: phones?.[idx] ?? null, message });
      });
    } else if (payload.clientName) {
      entries.push({
        name:    payload.clientName as string,
        phone:   (payload.phone ?? null) as string | null,
        message: payload.message as string ?? "",
      });
    }

    if (entries.length > 0) {
      await prisma.whatsappMessage.createMany({
        data: entries.map((e) => ({
          barbershopId: action.barbershopId,
          customerName: e.name,
          phone:        e.phone ?? "",
          message:      e.message,
          type:         action.type,
          actionId:     action.id,
          status:       "QUEUED",
        })),
      });
      await notifyWhatsappQueued(
        action.barbershopId,
        entries.length,
        entries.length === 1 ? entries[0].name : undefined,
      );
    }
  }

  await prisma.auditLog.create({
    data: {
      barbershopId: action.barbershopId,
      userId:       session.user.id,
      action:       "action.approved",
      entity:       "Action",
      entityId:     action.id,
      metadata:     JSON.stringify({ type: action.type }),
    },
  });

  return NextResponse.json({ ok: true });
}
