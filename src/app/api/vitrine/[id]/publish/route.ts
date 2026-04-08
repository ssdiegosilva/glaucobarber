import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { signVitrineFoto, deleteVitrineFoto } from "@/lib/storage";
import { publishCarouselToInstagram, publishCampaignToInstagram, fetchInstagramPermalink } from "@/lib/campaign-publish";
import { getKillSwitch } from "@/lib/platform-config";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  if (await getKillSwitch("kill_vitrine")) {
    return NextResponse.json({ error: "Funcionalidade temporariamente desabilitada" }, { status: 503 });
  }

  const post = await prisma.vitrinPost.findFirst({
    where: { id, barbershopId: session.user.barbershopId },
    include: { images: { orderBy: { position: "asc" } } },
  });
  if (!post) return NextResponse.json({ error: "Post não encontrado" }, { status: 404 });
  if (!["APPROVED", "SCHEDULED"].includes(post.status)) {
    return NextResponse.json({ error: "Post precisa estar aprovado para publicar" }, { status: 400 });
  }
  if (post.images.length === 0) {
    return NextResponse.json({ error: "Post sem fotos" }, { status: 400 });
  }
  if (!post.caption?.trim()) {
    return NextResponse.json({ error: "Post sem legenda. Adicione uma legenda antes de publicar." }, { status: 400 });
  }

  const integration = await prisma.integration.findUnique({
    where: { barbershopId: session.user.barbershopId },
    select: { instagramPageAccessToken: true, instagramBusinessId: true },
  });
  if (!integration?.instagramPageAccessToken || !integration.instagramBusinessId) {
    return NextResponse.json(
      { error: "Instagram não configurado. Acesse Configurações > Integrações para conectar." },
      { status: 400 },
    );
  }

  // Sign all photo URLs
  const signedUrls: string[] = [];
  for (const img of post.images) {
    const url = await signVitrineFoto(img.path);
    if (url) signedUrls.push(url);
  }
  if (signedUrls.length === 0) {
    return NextResponse.json({ error: "Erro ao acessar as fotos" }, { status: 500 });
  }

  const token      = integration.instagramPageAccessToken;
  const businessId = integration.instagramBusinessId;

  // Publish: carousel if ≥2 photos, single if only 1
  let postId: string;
  try {
    if (signedUrls.length >= 2) {
      postId = await publishCarouselToInstagram(token, businessId, signedUrls, post.caption);
    } else {
      postId = await publishCampaignToInstagram(token, businessId, signedUrls[0], post.caption);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[vitrine/publish] Instagram error:", msg);
    await prisma.vitrinPost.update({
      where: { id },
      data: { status: "FAILED", errorMsg: msg },
    });
    return NextResponse.json({ error: msg }, { status: 422 });
  }

  const permalink = await fetchInstagramPermalink(postId, token);

  // Delete photos from storage (historical record stays in DB)
  await Promise.allSettled(post.images.map((img) => deleteVitrineFoto(img.path).catch(() => null)));
  await prisma.vitrineFoto.deleteMany({ where: { vitrinPostId: id } });

  await prisma.vitrinPost.update({
    where: { id },
    data: {
      status:             "PUBLISHED",
      publishedAt:        new Date(),
      instagramPostId:    postId,
      instagramPermalink: permalink,
    },
  });

  return NextResponse.json({ ok: true, postId, permalink });
}
