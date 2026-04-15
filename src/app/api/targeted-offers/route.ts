import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/lib/ai/provider";
import { checkAiAllowance, consumeAiCredit } from "@/lib/billing";

// GET /api/targeted-offers — list all offers for the barbershop
export async function GET() {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const offers = await prisma.targetedOffer.findMany({
    where: { barbershopId: session.user.barbershopId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ offers });
}

// POST /api/targeted-offers — create offer, personalize messages, queue WhatsApp
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const barbershopId = session.user.barbershopId;

  const body = await req.json() as {
    title: string;
    type: "product" | "service";
    referenceIds: string[];
    referenceNames: string[];
    daysInactive: number;
    discount: boolean;
    discountPct?: number | null;
    messageTemplate: string;
    mediaImageUrl?: string | null;
    manualCustomerIds?: string[];
  };

  if (!body.title?.trim())           return NextResponse.json({ error: "Título é obrigatório" }, { status: 400 });
  if (!body.referenceIds?.length)    return NextResponse.json({ error: "Selecione ao menos 1 item" }, { status: 400 });
  if (!body.messageTemplate?.trim()) return NextResponse.json({ error: "Template de mensagem é obrigatório" }, { status: 400 });

  // Re-fetch qualifying customers
  const days = Math.max(1, body.daysInactive ?? 30);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  let customerList: { id: string; name: string; phone: string }[] = [];

  if (body.type === "product") {
    const rows = await prisma.$queryRaw<{ customerId: string }[]>`
      SELECT DISTINCT v."customerId"
      FROM "visit_items" vi
      JOIN "visits" v ON v.id = vi."visitId"
      WHERE v."barbershopId" = ${barbershopId}
        AND vi."productId" = ANY(${body.referenceIds}::text[])
        AND v."customerId" IS NOT NULL
      GROUP BY v."customerId"
      HAVING MAX(v."visitedAt") < ${cutoff}
    `;
    const ids = rows.map((r) => r.customerId);
    if (ids.length > 0) {
      const customers = await prisma.customer.findMany({
        where: { id: { in: ids }, barbershopId, deletedAt: null, phone: { not: null } },
        select: { id: true, name: true, phone: true },
        take: 200,
      });
      customerList = customers.filter((c): c is typeof c & { phone: string } => Boolean(c.phone));
    }
  } else {
    const rows = await prisma.$queryRaw<{ customerId: string }[]>`
      SELECT DISTINCT a."customerId"
      FROM "appointments" a
      WHERE a."barbershopId" = ${barbershopId}
        AND a."serviceId" = ANY(${body.referenceIds}::text[])
        AND a."customerId" IS NOT NULL
        AND a."status" = 'COMPLETED'
      GROUP BY a."customerId"
      HAVING MAX(a."scheduledAt") < ${cutoff}
    `;
    const ids = rows.map((r) => r.customerId);
    if (ids.length > 0) {
      const customers = await prisma.customer.findMany({
        where: { id: { in: ids }, barbershopId, deletedAt: null, phone: { not: null } },
        select: { id: true, name: true, phone: true },
        take: 200,
      });
      customerList = customers.filter((c): c is typeof c & { phone: string } => Boolean(c.phone));
    }
  }

  // Add manually selected customers (dedup with filter results)
  if (body.manualCustomerIds?.length) {
    const existingIds = new Set(customerList.map((c) => c.id));
    const manualIds = body.manualCustomerIds.filter((id) => !existingIds.has(id));
    if (manualIds.length > 0) {
      const manualCustomers = await prisma.customer.findMany({
        where: { id: { in: manualIds }, barbershopId, deletedAt: null, phone: { not: null } },
        select: { id: true, name: true, phone: true },
      });
      customerList.push(...manualCustomers.filter((c): c is typeof c & { phone: string } => Boolean(c.phone)));
    }
  }

  if (customerList.length === 0) {
    return NextResponse.json({ error: "Nenhum cliente elegível encontrado" }, { status: 400 });
  }

  // Check AI allowance (need 1 credit per customer)
  const { allowed } = await checkAiAllowance(barbershopId);
  if (!allowed) {
    return NextResponse.json(
      { error: "ai_limit_reached", message: "Limite de IA atingido.", upgradeUrl: "/billing" },
      { status: 402 }
    );
  }

  const ai = getAIProvider();

  // Create the TargetedOffer record
  const offer = await prisma.targetedOffer.create({
    data: {
      barbershopId,
      title:           body.title.trim(),
      type:            body.type,
      referenceIds:    body.referenceIds,
      referenceNames:  body.referenceNames,
      daysInactive:    days,
      discount:        body.discount,
      discountPct:     body.discount ? (body.discountPct ?? null) : null,
      messageTemplate: body.messageTemplate.trim(),
      mediaImageUrl:   body.mediaImageUrl ?? null,
      customersCount:  customerList.length,
    },
  });

  // Personalize message per customer + create WhatsApp queue entries
  const offerCustomers: { customerId: string; customerName: string; phone: string; message: string; whatsappMsgId: string | null }[] = [];

  for (const customer of customerList) {
    let message = body.messageTemplate;
    try {
      message = await ai.generateTargetedOfferMessage(
        body.messageTemplate,
        customer.name,
        body.discount,
        body.discountPct ?? null,
        body.referenceNames
      );
      await consumeAiCredit(barbershopId, "targeted_offer");
    } catch {
      // Fallback: simple name substitution
      message = body.messageTemplate.replace(/\{nome\}/gi, customer.name);
    }

    // Queue WhatsApp message
    let whatsappMsgId: string | null = null;
    try {
      const msg = await prisma.whatsappMessage.create({
        data: {
          barbershopId,
          customerId:   customer.id,
          customerName: customer.name,
          phone:        customer.phone,
          message,
          type:         "targeted_offer",
          messageKind:  body.mediaImageUrl ? "image" : "text",
          mediaImageUrl: body.mediaImageUrl ?? null,
          status:       "QUEUED",
        },
      });
      whatsappMsgId = msg.id;
    } catch {
      // non-fatal
    }

    offerCustomers.push({ customerId: customer.id, customerName: customer.name, phone: customer.phone, message, whatsappMsgId });
  }

  // Batch create TargetedOfferCustomer records
  await prisma.targetedOfferCustomer.createMany({
    data: offerCustomers.map((c) => ({
      targetedOfferId: offer.id,
      customerId:      c.customerId,
      customerName:    c.customerName,
      phone:           c.phone,
      message:         c.message,
      whatsappMsgId:   c.whatsappMsgId,
    })),
  });

  // System notification
  await prisma.systemNotification.create({
    data: {
      barbershopId,
      type:  "WHATSAPP_QUEUED",
      title: "Oferta Direcionada criada",
      body:  `"${offer.title}" — ${customerList.length} mensagem(ns) na fila do WhatsApp.`,
      link:  `/ofertas/${offer.id}`,
    },
  });

  return NextResponse.json({ id: offer.id, customersCount: customerList.length });
}
