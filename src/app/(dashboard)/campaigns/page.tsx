import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { CampaignsClient } from "./campaigns-client";

export default async function CampaignsPage() {
  const session = await auth();
  if (!session?.user?.barbershopId) redirect("/onboarding");

  const campaigns = await prisma.campaign.findMany({
    where:   { barbershopId: session.user.barbershopId },
    orderBy: { createdAt: "desc" },
    include: { suggestion: { select: { type: true } } },
  });
  const integration = await prisma.integration.findUnique({ where: { barbershopId: session.user.barbershopId } });

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Campanhas"
        subtitle="Histórico e aprovações de campanhas geradas pela IA"
        userName={session.user.name}
      />

      <div className="p-6 space-y-4">
        <CampaignsClient
          campaigns={campaigns.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))}
          instagramConfigured={!!(integration?.instagramPageAccessToken && integration.instagramBusinessId)}
        />
      </div>
    </div>
  );
}
