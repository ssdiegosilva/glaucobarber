import { prisma } from "@/lib/prisma";
import { notifyWhatsappQueued } from "@/lib/notifications";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type AppointmentEvent =
  | "CREATED"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW"
  | "RESCHEDULED";

/** Monta a mensagem WhatsApp de acordo com o evento do agendamento. */
function buildMessage(
  event: AppointmentEvent,
  customerName: string,
  scheduledAt: Date,
  serviceName?: string | null,
): string {
  const firstName = customerName.split(" ")[0];
  const dateStr = format(scheduledAt, "dd/MM (EEEE)", { locale: ptBR });
  const timeStr = format(scheduledAt, "HH:mm");
  const serviceStr = serviceName ? ` — ${serviceName}` : "";

  switch (event) {
    case "CREATED":
      return `Olá ${firstName}! Seu agendamento foi criado para ${dateStr} às ${timeStr}${serviceStr}. Te esperamos!`;

    case "CONFIRMED":
      return `${firstName}, seu agendamento de ${dateStr} às ${timeStr} foi confirmado! Até lá!`;

    case "IN_PROGRESS":
      return `${firstName}, seu atendimento começou! Aproveite o momento.`;

    case "COMPLETED":
      return `${firstName}, obrigado pela visita! Esperamos que tenha gostado. Volte sempre!`;

    case "CANCELLED":
      return `${firstName}, seu agendamento de ${dateStr} às ${timeStr} foi cancelado. Se quiser reagendar, é só nos chamar!`;

    case "NO_SHOW":
      return `${firstName}, sentimos sua falta hoje! Se quiser remarcar, estamos à disposição.`;

    case "RESCHEDULED":
      return `${firstName}, seu agendamento foi reagendado para ${dateStr} às ${timeStr}${serviceStr}. Te esperamos no novo horário!`;
  }
}

/**
 * Cria uma mensagem WhatsApp na fila para envio manual (wa.me).
 * O barbeiro verá a mensagem na aba de WhatsApp e enviará pelo link.
 * Fire-and-forget: não lança erro se falhar.
 */
export async function notifyAppointmentEvent(opts: {
  barbershopId: string;
  customerId: string;
  scheduledAt: Date;
  serviceName?: string | null;
  event: AppointmentEvent;
}): Promise<void> {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: opts.customerId },
      select: { id: true, name: true, phone: true },
    });

    if (!customer?.phone) return;

    const message = buildMessage(
      opts.event,
      customer.name,
      opts.scheduledAt,
      opts.serviceName,
    );

    await prisma.whatsappMessage.create({
      data: {
        barbershopId: opts.barbershopId,
        customerId: customer.id,
        customerName: customer.name,
        phone: customer.phone,
        message,
        type: "general",
        messageKind: "text",
        status: "QUEUED",
      },
    });

    await notifyWhatsappQueued(opts.barbershopId, 1, customer.name);
  } catch (err) {
    console.error("[appointment-notify] erro ao criar notificação:", err);
  }
}
