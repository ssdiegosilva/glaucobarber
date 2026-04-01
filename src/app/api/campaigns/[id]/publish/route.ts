import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function publishToInstagram(token: string, businessId: string, imageUrl: string, caption: string) {
  try {
    const mediaRes = await fetch(`https://graph.facebook.com/v21.0/${businessId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ image_url: imageUrl, caption, access_token: token }),
    });
    const mediaJson = await mediaRes.json();
    if (!mediaRes.ok) throw new Error(mediaJson.error?.message ?? "Erro ao criar media container");

    const publishRes = await fetch(`https://graph.facebook.com/v21.0/${businessId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ creation_id: mediaJson.id, access_token: token }),
    });
    const publishJson = await publishRes.json();
    if (!publishRes.ok) throw new Error(publishJson.error?.message ?? "Erro ao publicar");
    return publishJson.id as string;
  } catch (err) {
    throw err;
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaign = await prisma.campaign.findUnique({ where: { id: params.id } });
  if (!campaign || campaign.barbershopId !== session.user.barbershopId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (campaign.status !== "APPROVED") return NextResponse.json({ error: "Apenas campanhas aprovadas" }, { status: 400 });
  if (!campaign.imageUrl) return NextResponse.json({ error: "Campanha precisa de imagem" }, { status: 400 });

  const integration = await prisma.integration.findFirst({ where: { barbershopId: session.user.barbershopId, provider: "trinks" } });
  // NOTE: instagram fields estão na mesma tabela
  if (!integration?.instagramPageAccessToken || !integration.instagramBusinessId) {
    return NextResponse.json({ error: "Instagram não configurado" }, { status: 400, code: "IG_NOT_CONFIGURED" } as any);
  }

  try {
    const postId = await publishToInstagram(
      integration.instagramPageAccessToken,
      integration.instagramBusinessId,
      campaign.imageUrl,
      campaign.text,
    );

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: "PUBLISHED", publishedAt: new Date(), instagramPostId: postId },
    });

    return NextResponse.json({ ok: true, postId });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
