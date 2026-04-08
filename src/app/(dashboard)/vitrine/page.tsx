import { requireBarbershop } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { checkAiAllowance } from "@/lib/billing";
import { VitrineClient } from "./vitrine-client";

export default async function VitrinePage() {
  const session = await requireBarbershop();
  const barbershopId = session.user.barbershopId;

  const [posts, integration, allowance] = await Promise.all([
    prisma.vitrinPost.findMany({
      where: { barbershopId, status: { not: "DISMISSED" } },
      include: { images: { orderBy: { position: "asc" } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.integration.findUnique({
      where: { barbershopId },
      select: { instagramPageAccessToken: true, instagramBusinessId: true, instagramUsername: true },
    }),
    checkAiAllowance(barbershopId),
  ]);

  const instagramConfigured = !!(integration?.instagramPageAccessToken && integration?.instagramBusinessId);

  return (
    <div className="flex flex-col h-full">
      <Header title="Vitrine" subtitle="Poste seus trabalhos no Instagram" userName={session.user.name} />
      <VitrineClient
        initialPosts={posts.map((p) => ({
          ...p,
          createdAt:   p.createdAt.toISOString(),
          updatedAt:   p.updatedAt.toISOString(),
          scheduledAt: p.scheduledAt?.toISOString() ?? null,
          publishedAt: p.publishedAt?.toISOString() ?? null,
          images:      p.images.map((img) => ({ ...img, createdAt: img.createdAt.toISOString() })),
        }))}
        instagramConfigured={instagramConfigured}
        instagramUsername={integration?.instagramUsername ?? null}
        aiAllowed={allowance.allowed}
      />
    </div>
  );
}
