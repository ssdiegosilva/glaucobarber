import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/whatsapp/templates/sync
// Busca templates aprovados da Meta e faz upsert no banco.
// Requer whatsappWabaId salvo na Integration.
export async function POST() {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const barbershopId = session.user.barbershopId;

  const integration = await prisma.integration.findUnique({
    where:  { barbershopId },
    select: { whatsappAccessToken: true, whatsappWabaId: true },
  });

  if (!integration?.whatsappAccessToken) {
    return NextResponse.json({ error: "WhatsApp não configurado" }, { status: 400 });
  }
  if (!integration.whatsappWabaId) {
    return NextResponse.json({ error: "WABA ID não configurado. Adicione nas Integrações." }, { status: 400 });
  }

  const { whatsappAccessToken: token, whatsappWabaId: wabaId } = integration;

  // Busca templates aprovados da Meta
  const url = `https://graph.facebook.com/v21.0/${wabaId}/message_templates?fields=name,status,components,language&limit=100&status=APPROVED&access_token=${token}`;
  const res = await fetch(url);
  const json = await res.json();

  if (!res.ok || json.error) {
    return NextResponse.json(
      { error: json.error?.message ?? "Erro ao buscar templates da Meta" },
      { status: 502 }
    );
  }

  const templates: Array<{
    name: string;
    status: string;
    language: string;
    components: Array<{ type: string; text?: string; example?: { body_text?: string[][] } }>;
  }> = json.data ?? [];

  let synced = 0;

  for (const tpl of templates) {
    if (tpl.status !== "APPROVED") continue;

    const bodyComponent = tpl.components.find((c) => c.type === "BODY");
    const bodyText = bodyComponent?.text ?? "";

    // Detecta variáveis {{1}}, {{2}}, etc.
    const varMatches = bodyText.match(/\{\{\d+\}\}/g) ?? [];
    const variables = varMatches.map((v, i) => ({
      key:          v,
      label:        `Variável ${i + 1}`,
      defaultValue: "",
    }));

    await prisma.whatsappTemplate.upsert({
      where:  { barbershopId_metaName: { barbershopId, metaName: tpl.name } },
      create: {
        barbershopId,
        metaName:  tpl.name,
        label:     tpl.name.replace(/_/g, " "),
        body:      bodyText,
        variables: JSON.stringify(variables),
        active:    true,
      },
      update: {
        body:      bodyText,
        variables: JSON.stringify(variables),
        // não sobrescreve label personalizado que o usuário possa ter editado
      },
    });

    synced++;
  }

  return NextResponse.json({ synced });
}
