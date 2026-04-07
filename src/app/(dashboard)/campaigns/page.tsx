import { requireBarbershop } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { CampaignsClient } from "./campaigns-client";
import { getAiImageConfig } from "@/lib/platform-config";
import { canAccess } from "@/lib/access";
import { getPlan } from "@/lib/billing";
import { UpgradeWall } from "@/components/billing/UpgradeWall";

export default async function CampaignsPage() {
  const session = await requireBarbershop();

  const { effectiveTier } = await getPlan(session.user.barbershopId);
  const allowed = await canAccess(session.user.barbershopId, effectiveTier, "campaigns");
  if (!allowed) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Campanhas" subtitle="Marketing e comunicação" userName={session.user.name} />
        <UpgradeWall
          feature="Campanhas"
          requiredPlan="STARTER"
          description="Crie campanhas de marketing com IA, gere imagens e publique direto no Instagram."
        />
      </div>
    );
  }

  // Limpa campanhas travadas em GENERATING há mais de 5 minutos
  const stuckThreshold = new Date(Date.now() - 5 * 60 * 1000);
  const stuck = await prisma.campaign.findMany({
    where: { barbershopId: session.user.barbershopId, status: "GENERATING", createdAt: { lt: stuckThreshold } },
    select: { id: true, title: true },
  });
  if (stuck.length > 0) {
    await prisma.campaign.updateMany({
      where: { id: { in: stuck.map((c) => c.id) } },
      data:  { status: "FAILED", errorMsg: "Tempo limite excedido ao gerar a campanha. Tente novamente." },
    });
    for (const c of stuck) {
      await prisma.systemNotification.create({
        data: {
          barbershopId: session.user.barbershopId,
          type:  "SYSTEM",
          title: "Falha ao criar campanha",
          body:  `"${c.title}" não foi criada a tempo. Toque para tentar novamente.`,
          link:  "/campaigns",
        },
      }).catch(() => null);
    }
  }

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
          imageCreditCosts={{ low: aiConfig.creditCostLow, medium: aiConfig.creditCostMedium, high: aiConfig.creditCostHigh }}
        />
      </div>
    </div>
  );
}
