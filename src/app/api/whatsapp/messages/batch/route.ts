import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyWhatsappQueued } from "@/lib/notifications";

// POST /api/whatsapp/messages/batch
// Cria N mensagens de template agendadas (uma por cliente selecionado).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const barbershopId = session.user.barbershopId;

  const {
    customerIds,
    templateName,
    templateVars,   // string[] — pode conter "{{name}}" como placeholder
    scheduledFor,   // ISO string | null
    messagePreview, // texto do template para preview (body do template)
  }: {
    customerIds:     string[];
    templateName:    string;
    templateVars:    string[];
    scheduledFor:    string | null;
    messagePreview:  string;
  } = await req.json();

  if (!customerIds?.length || !templateName) {
    return NextResponse.json({ error: "customerIds e templateName são obrigatórios" }, { status: 400 });
  }

  // Busca os clientes selecionados
  const customers = await prisma.customer.findMany({
    where: { id: { in: customerIds }, barbershopId, deletedAt: null },
    select: { id: true, name: true, phone: true },
  });

  const scheduledDate = scheduledFor ? new Date(scheduledFor) : null;

  const messages = await prisma.$transaction(
    customers
      .filter((c) => !!c.phone)
      .map((c) => {
        // Resolve {{name}} nas variáveis pelo nome real do cliente
        const resolvedVars = (templateVars ?? []).map((v) =>
          v.replace(/\{\{name\}\}/gi, c.name)
        );
        // Monta preview da mensagem com variáveis resolvidas
        let preview = messagePreview;
        resolvedVars.forEach((val, i) => {
          preview = preview.replace(`{{${i + 1}}}`, val);
        });

        return prisma.whatsappMessage.create({
          data: {
            barbershopId,
            customerId:   c.id,
            customerName: c.name,
            phone:        c.phone!,
            message:      preview,
            type:         "general",
            messageKind:  "template",
            templateName,
            templateVars: JSON.stringify(resolvedVars),
            sentManually: false,
            status:       "QUEUED",
            scheduledFor: scheduledDate,
          },
        });
      })
  );

  // Atualiza lastWhatsappSentAt dos clientes
  await prisma.customer.updateMany({
    where: { id: { in: customers.map((c) => c.id) } },
    data:  { lastWhatsappSentAt: new Date() },
  });

  if (messages.length > 0) {
    await notifyWhatsappQueued(barbershopId, messages.length);
  }

  return NextResponse.json({ created: messages.length });
}
