// WhatsApp Business API – Meta Graph API v21.0
// Adaptado de flama-app/src/lib/whatsapp.ts (apenas camada de envio – sem TTS, sessões ou chatbot)
//
// Credenciais são por barbershop (armazenadas em Integration.whatsappAccessToken/PhoneNumberId).
// O WHATSAPP_VERIFY_TOKEN é global (env) pois é do app Meta, não por tenant.

const WHATSAPP_API_URL = "https://graph.facebook.com/v21.0";

export interface WhatsAppCredentials {
  accessToken:   string;
  phoneNumberId: string;
}

/** Normaliza número para o formato esperado pela Meta API: 55XXXXXXXXXX */
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "").replace(/^\+/, "");
}

/**
 * Envia uma mensagem de texto via WhatsApp.
 * Retorna o wamid (Meta message ID) para rastreamento de entrega.
 */
export async function sendWhatsAppMessage(
  to:    string,
  text:  string,
  creds: WhatsAppCredentials
): Promise<string> {
  const phone = normalizePhone(to);

  const response = await fetch(`${WHATSAPP_API_URL}/${creds.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${creds.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type:    "individual",
      to:                phone,
      type:              "text",
      text:              { body: text },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error("[WhatsApp] send error:", JSON.stringify(error));
    throw new Error(`WhatsApp API error: ${response.status}`);
  }

  const data = await response.json();
  // data.messages[0].id = wamid
  return (data?.messages?.[0]?.id as string) ?? "";
}

// ── Tipos de webhook ──────────────────────────────────────────

interface WhatsAppStatusEntry {
  id:           string; // wamid
  status:       "sent" | "delivered" | "read" | "failed";
  timestamp:    string;
  recipient_id: string;
  errors?:      Array<{ code: number; title: string }>;
}

interface WhatsAppChange {
  value: {
    messaging_product: string;
    metadata: { display_phone_number: string; phone_number_id: string };
    statuses?: WhatsAppStatusEntry[];
    messages?: unknown[];
  };
  field: string;
}

export interface WhatsAppWebhookBody {
  object: string;
  entry: Array<{
    id:      string;
    changes: WhatsAppChange[];
  }>;
}

export interface DeliveryStatus {
  metaMessageId: string;
  status:        "sent" | "delivered" | "read" | "failed";
  phoneNumberId: string; // identifica qual barbershop
}

/**
 * Extrai delivery statuses de um payload de webhook do Meta.
 * Inclui phoneNumberId para identificar o barbershop.
 */
export function extractDeliveryStatuses(body: WhatsAppWebhookBody): DeliveryStatus[] {
  const results: DeliveryStatus[] = [];

  if (body.object !== "whatsapp_business_account") return results;

  for (const entry of body.entry) {
    for (const change of entry.changes) {
      if (change.field !== "messages") continue;
      const phoneNumberId = change.value.metadata.phone_number_id;
      for (const s of change.value.statuses ?? []) {
        results.push({ metaMessageId: s.id, status: s.status, phoneNumberId });
      }
    }
  }

  return results;
}
