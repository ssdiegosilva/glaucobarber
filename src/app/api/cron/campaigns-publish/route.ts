import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signCampaignImage, deleteCampaignImage } from "@/lib/storage";
import { publishCampaignToInstagram, fetchInstagramPermalink } from "@/lib/campaign-publish";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now   = new Date();
  const start = Date.now();
  const run   = await prisma.cronRun.create({
    data: { cronName: "campaigns-publish", status: "running" },
  });

  const scheduled = await prisma.campaign.findMany({
    where: {
      status:      "SCHEDULED",
      scheduledAt: { lte: now },
    },
    take: 20,
  });

  if (scheduled.length === 0) {
    await prisma.cronRun.update({
      where: { id: run.id },
      data: { status: "success", durationMs: Date.now() - start },
    });
    return NextResponse.json({ date: now.toISOString(), total: 0, published: 0, failed: 0 });
  }

  // Group by barbershopId to batch integration lookups
  const barbershopIds = [...new Set(scheduled.map((c) => c.barbershopId))];
  const integrations  = await prisma.integration.findMany({
    where: { barbershopId: { in: barbershopIds }, provider: "trinks" },
    select: { barbershopId: true, instagramPageAccessToken: true, instagramBusinessId: true },
  });
  const integrationMap = Object.fromEntries(integrations.map((i) => [i.barbershopId, i]));

  let published = 0;
  let failed    = 0;

  for (const campaign of scheduled) {
    const integration = integrationMap[campaign.barbershopId];
    if (!integration?.instagramPageAccessToken || !integration.instagramBusinessId) {
      // No Instagram configured — skip silently (don't mark as failed)
      continue;
    }

    let imageUrl = campaign.imageUrl;
    if (!imageUrl && campaign.templateId) {
      const tpl = await prisma.template.findUnique({ where: { id: campaign.templateId } });
      imageUrl = tpl?.imageUrl ?? null;
    }
    if (!imageUrl) {
      // Can't publish without image — skip
      continue;
    }

    try {
      const freshUrl = await signCampaignImage(imageUrl);
      if (freshUrl) imageUrl = freshUrl;

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
          publishedAt:        now,
          instagramPostId:    postId,
          instagramPermalink: permalink,
          imageUrl:           null,
        },
      });

      published++;
    } catch (err) {
      console.error(`[cron/campaigns-publish] Failed campaign ${campaign.id}:`, err);
      failed++;
    }
  }

  await prisma.cronRun.update({
    where: { id: run.id },
    data: { status: failed > 0 ? "failed" : "success", durationMs: Date.now() - start },
  });

  return NextResponse.json({
    date:      now.toISOString(),
    total:     scheduled.length,
    published,
    failed,
  });
}
