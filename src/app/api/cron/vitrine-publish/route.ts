import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signVitrineFoto, deleteVitrineFoto } from "@/lib/storage";
import { publishCarouselToInstagram, publishCampaignToInstagram, fetchInstagramPermalink } from "@/lib/campaign-publish";
import { getKillSwitch } from "@/lib/platform-config";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (await getKillSwitch("kill_vitrine")) {
    return NextResponse.json({ skipped: true, reason: "kill_vitrine" });
  }

  const now   = new Date();
  const start = Date.now();
  const run   = await prisma.cronRun.create({
    data: { cronName: "vitrine-publish", status: "running" },
  });

  const scheduled = await prisma.vitrinPost.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: now } },
    include: { images: { orderBy: { position: "asc" } } },
    take: 20,
  });

  if (scheduled.length === 0) {
    await prisma.cronRun.update({
      where: { id: run.id },
      data: { status: "success", durationMs: Date.now() - start },
    });
    return NextResponse.json({ date: now.toISOString(), total: 0, published: 0, failed: 0 });
  }

  const barbershopIds = [...new Set(scheduled.map((p) => p.barbershopId))];
  const integrations  = await prisma.integration.findMany({
    where:  { barbershopId: { in: barbershopIds } },
    select: { barbershopId: true, instagramPageAccessToken: true, instagramBusinessId: true },
  });
  const integrationMap = Object.fromEntries(integrations.map((i) => [i.barbershopId, i]));

  let published = 0;
  let failed    = 0;

  for (const post of scheduled) {
    if (post.images.length === 0 || !post.caption?.trim()) {
      failed++;
      await prisma.vitrinPost.update({
        where: { id: post.id },
        data: { status: "FAILED", errorMsg: "Post sem fotos ou legenda" },
      });
      continue;
    }

    const integration = integrationMap[post.barbershopId];
    if (!integration?.instagramPageAccessToken || !integration.instagramBusinessId) {
      await prisma.vitrinPost.update({
        where: { id: post.id },
        data: { status: "FAILED", errorMsg: "Instagram não configurado" },
      });
      failed++;
      continue;
    }

    try {
      const signedUrls: string[] = [];
      for (const img of post.images) {
        const url = await signVitrineFoto(img.path);
        if (url) signedUrls.push(url);
      }
      if (signedUrls.length === 0) throw new Error("Erro ao gerar URLs das fotos");

      const token      = integration.instagramPageAccessToken;
      const businessId = integration.instagramBusinessId;

      let postId: string;
      if (signedUrls.length >= 2) {
        postId = await publishCarouselToInstagram(token, businessId, signedUrls, post.caption);
      } else {
        postId = await publishCampaignToInstagram(token, businessId, signedUrls[0], post.caption);
      }

      const permalink = await fetchInstagramPermalink(postId, token);

      await Promise.allSettled(post.images.map((img) => deleteVitrineFoto(img.path).catch(() => null)));
      await prisma.vitrineFoto.deleteMany({ where: { vitrinPostId: post.id } });

      await prisma.vitrinPost.update({
        where: { id: post.id },
        data: {
          status:             "PUBLISHED",
          publishedAt:        now,
          instagramPostId:    postId,
          instagramPermalink: permalink,
        },
      });

      published++;
    } catch (err) {
      console.error(`[cron/vitrine-publish] Failed post ${post.id}:`, err);
      await prisma.vitrinPost.update({
        where: { id: post.id },
        data: { status: "FAILED", errorMsg: err instanceof Error ? err.message : "Erro desconhecido" },
      });
      failed++;
    }
  }

  await prisma.cronRun.update({
    where: { id: run.id },
    data: { status: failed > 0 ? "failed" : "success", durationMs: Date.now() - start },
  });

  return NextResponse.json({ date: now.toISOString(), total: scheduled.length, published, failed });
}
