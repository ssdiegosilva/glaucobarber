import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function waitForMediaReady(containerId: string, token: string, maxWaitMs = 30_000): Promise<void> {
  const interval = 2_000;
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${containerId}?fields=status_code&access_token=${token}`
    );
    const json = await res.json();
    const status = json.status_code as string | undefined;
    if (status === "FINISHED") return;
    if (status === "ERROR" || status === "EXPIRED") throw new Error(`Media container status: ${status}`);
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error("Timeout aguardando processamento da imagem pelo Instagram");
}

async function publishToInstagram(token: string, businessId: string, imageUrl: string, caption: string) {
  const mediaRes = await fetch(`https://graph.facebook.com/v21.0/${businessId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ image_url: imageUrl, caption, access_token: token }),
  });
  const mediaJson = await mediaRes.json();
  if (!mediaRes.ok) throw new Error(mediaJson.error?.message ?? "Erro ao criar media container");

  await waitForMediaReady(mediaJson.id, token);

  const publishRes = await fetch(`https://graph.facebook.com/v21.0/${businessId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ creation_id: mediaJson.id, access_token: token }),
  });
  const publishJson = await publishRes.json();
  if (!publishRes.ok) throw new Error(publishJson.error?.message ?? "Erro ao publicar");
  return publishJson.id as string;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { imageUrl?: string | null };
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign || campaign.barbershopId !== session.user.barbershopId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (campaign.status !== "APPROVED") return NextResponse.json({ error: "Apenas campanhas aprovadas" }, { status: 400 });

  let imageUrl = body.imageUrl ?? campaign.imageUrl;
  if (!imageUrl && campaign.templateId) {
    const tpl = await prisma.template.findUnique({ where: { id: campaign.templateId } });
    imageUrl = tpl?.imageUrl ?? null;
  }
  if (!imageUrl) return NextResponse.json({ error: "Campanha precisa de imagem" }, { status: 400 });

  const integration = await prisma.integration.findFirst({ where: { barbershopId: session.user.barbershopId, provider: "trinks" } });
  // NOTE: instagram fields estão na mesma tabela
  if (!integration?.instagramPageAccessToken || !integration.instagramBusinessId) {
    return NextResponse.json({ error: "Instagram não configurado" }, { status: 400, code: "IG_NOT_CONFIGURED" } as any);
  }

  try {
    const postId = await publishToInstagram(
      integration.instagramPageAccessToken,
      integration.instagramBusinessId,
      imageUrl,
      campaign.text,
    );

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: "PUBLISHED", publishedAt: new Date(), instagramPostId: postId, imageUrl },
    });

    return NextResponse.json({ ok: true, postId });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
