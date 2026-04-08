import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { signVitrineFoto, deleteVitrineFoto, uploadVitrineFoto } from "@/lib/storage";
import { publishCarouselToInstagram, publishCampaignToInstagram, fetchInstagramPermalink } from "@/lib/campaign-publish";
import { getKillSwitch } from "@/lib/platform-config";
import sharp from "sharp";

// Instagram accepts aspect ratios between 4:5 (0.8) and 1.91:1.
const IG_MIN_RATIO = 0.8;
const IG_MAX_RATIO = 1.91;

/**
 * Downloads an image and crops it to fit Instagram's aspect ratio requirements.
 * Returns the cropped Buffer, or null if no crop is needed.
 */
async function cropForInstagram(imageUrl: string): Promise<Buffer | null> {
  const res = await fetch(imageUrl);
  if (!res.ok) return null;

  const buffer = Buffer.from(await res.arrayBuffer());
  const meta   = await sharp(buffer).metadata();
  const w = meta.width  ?? 1;
  const h = meta.height ?? 1;
  const ratio = w / h;

  if (ratio >= IG_MIN_RATIO && ratio <= IG_MAX_RATIO) return null; // already valid

  let cropW = w;
  let cropH = h;

  if (ratio < IG_MIN_RATIO) {
    // Too tall (e.g. portrait 3:4, stories 9:16) → crop to 4:5
    cropH = Math.round(w / IG_MIN_RATIO);
  } else {
    // Too wide → crop to 1.91:1
    cropW = Math.round(h * IG_MAX_RATIO);
  }

  return sharp(buffer)
    .extract({
      left:   Math.floor((w - cropW) / 2),
      top:    Math.floor((h - cropH) / 2),
      width:  cropW,
      height: cropH,
    })
    .jpeg({ quality: 92 })
    .toBuffer();
}

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

  // Sign all photo URLs, cropping to valid Instagram aspect ratio if needed
  const tempPaths: string[] = []; // track temp uploads so we can clean them up
  const signedUrls: string[] = [];

  for (let i = 0; i < post.images.length; i++) {
    const img = post.images[i];
    const signedUrl = await signVitrineFoto(img.path);
    if (!signedUrl) continue;

    const croppedBuffer = await cropForInstagram(signedUrl);
    if (croppedBuffer) {
      // Upload the cropped version as a temporary file
      const { path, url } = await uploadVitrineFoto({
        barbershopId: session.user.barbershopId,
        postId:       post.id,
        fotoId:       `cropped-${i}`,
        buffer:       croppedBuffer,
        contentType:  "image/jpeg",
      });
      signedUrls.push(url);
      tempPaths.push(path);
    } else {
      signedUrls.push(signedUrl);
    }
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
    // Clean up any temp cropped uploads
    await Promise.allSettled(tempPaths.map((p) => deleteVitrineFoto(p).catch(() => null)));
    await prisma.vitrinPost.update({
      where: { id },
      data: { status: "FAILED", errorMsg: msg },
    });
    return NextResponse.json({ error: msg }, { status: 422 });
  }

  const permalink = await fetchInstagramPermalink(postId, token);

  // Delete original + temp photos from storage
  await Promise.allSettled([
    ...post.images.map((img) => deleteVitrineFoto(img.path).catch(() => null)),
    ...tempPaths.map((p) => deleteVitrineFoto(p).catch(() => null)),
  ]);
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
