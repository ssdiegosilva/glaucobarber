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

/**
 * Normaliza número para o formato esperado pela Meta API: 55XXXXXXXXXX (sem +).
 * Se o número tiver 10-11 dígitos (DDD + número sem código de país),
 * assume Brasil e adiciona 55 automaticamente.
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^\+/, "");
  // Número brasileiro sem código de país: 10 dígitos (fixo) ou 11 dígitos (celular)
  if (digits.length >= 10 && digits.length <= 11) {
    return `55${digits}`;
  }
  return digits;
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
    // Log only non-sensitive fields (avoid logging full Meta error which may contain tokens or phone numbers)
    console.error("[WhatsApp] send error:", response.status, error?.error?.code, error?.error?.message);
    throw new Error(`WhatsApp API error: ${response.status}`);
  }

  const data = await response.json();
  return (data?.messages?.[0]?.id as string) ?? "";
}

/**
 * Envia um template aprovado pela Meta via WhatsApp.
 * variables: valores posicionais para {{1}}, {{2}}, etc.
 * languageCode: código do idioma do template (padrão: pt_BR).
 */
export async function sendWhatsAppTemplate(
  to:           string,
  templateName: string,
  variables:    string[],
  creds:        WhatsAppCredentials,
  languageCode  = "pt_BR"
): Promise<string> {
  const phone = normalizePhone(to);

  const components = variables.length > 0
    ? [{
        type:       "body",
        parameters: variables.map((v) => ({ type: "text", text: v })),
      }]
    : [];

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
      type:              "template",
      template: {
        name:     templateName,
        language: { code: languageCode },
        components,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error("[WhatsApp] template send error:", response.status, error?.error?.code, error?.error?.message);
    throw new Error(`WhatsApp template API error: ${response.status}`);
  }

  const data = await response.json();
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
