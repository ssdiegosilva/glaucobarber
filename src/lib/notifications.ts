import { prisma } from "@/lib/prisma";

/**
 * Cria uma notificação no sininho quando mensagem(ns) são adicionadas à fila do WhatsApp.
 * Fire-and-forget: não lança erro se falhar.
 */
export async function notifyWhatsappQueued(
  barbershopId: string,
  count: number = 1,
  customerName?: string,
): Promise<void> {
  try {
    const body =
      count === 1 && customerName
        ? `Mensagem para ${customerName} aguarda envio manual.`
        : count === 1
        ? "Uma mensagem aguarda envio manual."
        : `${count} mensagens aguardam envio manual.`;

    await prisma.systemNotification.create({
      data: {
        barbershopId,
        type:  "WHATSAPP_QUEUED",
        title: count === 1 ? "WhatsApp: nova mensagem na fila" : `WhatsApp: ${count} mensagens na fila`,
        body,
        link:  "/whatsapp",
      },
    });
  } catch (err) {
    console.error("[notifications] erro ao criar notificação WHATSAPP_QUEUED:", err);
  }
}
