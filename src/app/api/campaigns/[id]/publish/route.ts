import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { signCampaignImage, deleteCampaignImage } from "@/lib/storage";
import { publishCampaignToInstagram, fetchInstagramPermalink } from "@/lib/campaign-publish";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { imageUrl?: string | null };

  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign || campaign.barbershopId !== session.user.barbershopId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!["APPROVED", "SCHEDULED"].includes(campaign.status)) {
    return NextResponse.json({ error: "Apenas campanhas aprovadas ou agendadas" }, { status: 400 });
  }

  let imageUrl = body.imageUrl ?? campaign.imageUrl;
  if (!imageUrl && campaign.templateId) {
    const tpl = await prisma.template.findUnique({ where: { id: campaign.templateId } });
    imageUrl = tpl?.imageUrl ?? null;
  }
  if (!imageUrl) return NextResponse.json({ error: "Campanha precisa de imagem" }, { status: 400 });

  const freshUrl = await signCampaignImage(imageUrl);
  if (freshUrl) imageUrl = freshUrl;

  const integration = await prisma.integration.findFirst({
    where: { barbershopId: session.user.barbershopId, provider: "trinks" },
  });
  if (!integration?.instagramPageAccessToken || !integration.instagramBusinessId) {
    return NextResponse.json({ error: "Instagram não configurado" }, { status: 400 });
  }

  try {
    const postId = await publishCampaignToInstagram(
      integration.instagramPageAccessToken,
      integration.instagramBusinessId,
      imageUrl,
      campaign.text,
    );

    const permalink = await fetchInstagramPermalink(postId, integration.instagramPageAccessToken);

    if (campaign.imageUrl) {
      await deleteCampaignImage(campaign.imageUrl).catch(() => null);
    }

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status:             "PUBLISHED",
        publishedAt:        new Date(),
        instagramPostId:    postId,
        instagramPermalink: permalink,
        imageUrl:           null,
      },
    });

    return NextResponse.json({ ok: true, postId, permalink });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
