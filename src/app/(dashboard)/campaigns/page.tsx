import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { CampaignsClient } from "./campaigns-client";
import { getAiImageConfig } from "@/lib/platform-config";

export default async function CampaignsPage() {
  const session = await auth();
  if (!session?.user?.barbershopId) redirect("/onboarding");

  const [campaigns, integration, activeOffers, barbershop, aiConfig] = await Promise.all([
    prisma.campaign.findMany({
      where:   { barbershopId: session.user.barbershopId },
      orderBy: { createdAt: "desc" },
      include: { suggestion: { select: { type: true } } },
    }),
    prisma.integration.findUnique({ where: { barbershopId: session.user.barbershopId } }),
    prisma.offer.findMany({
      where:   { barbershopId: session.user.barbershopId, status: "ACTIVE" },
      select:  { id: true, title: true, salePrice: true, type: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.barbershop.findUnique({ where: { id: session.user.barbershopId }, select: { brandStyle: true } }),
    getAiImageConfig(),
  ]);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Campanhas"
        subtitle="Histórico e aprovações de campanhas geradas pela IA"
        userName={session.user.name}
      />

      <div className="p-6 space-y-4">
        <CampaignsClient
          campaigns={campaigns.map((c) => ({
            ...c,
            createdAt:          c.createdAt.toISOString(),
            publishedAt:        c.publishedAt?.toISOString() ?? null,
            scheduledAt:        c.scheduledAt?.toISOString() ?? null,
            instagramPermalink: c.instagramPermalink ?? null,
          }))}
          instagramConfigured={!!(integration?.instagramPageAccessToken && integration.instagramBusinessId)}
          hasBrandStyle={!!barbershop?.brandStyle?.trim()}
          availableOffers={activeOffers.map((o) => ({ id: o.id, title: o.title, salePrice: Number(o.salePrice), type: o.type }))}
          imageCreditCost={aiConfig.creditCost}
        />
      </div>
    </div>
  );
}
