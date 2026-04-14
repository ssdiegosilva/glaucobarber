import { prisma } from "@/lib/prisma";
import { SegmentsClient } from "./segments-client";

export const dynamic = "force-dynamic";

export default async function AdminSegmentsPage() {
  const segments = await prisma.segment.findMany({
    include: {
      aiConfig: { select: { id: true } },
      _count: { select: { barbershops: true } },
    },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Segmentos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie os tipos de estabelecimento da plataforma — tema, módulos, categorias de serviço e prompts de IA.
        </p>
      </div>

      <SegmentsClient
        segments={segments.map((s) => ({
          id: s.id,
          key: s.key,
          displayName: s.displayName,
          tenantLabel: s.tenantLabel,
          icon: s.icon,
          colorPrimary: s.colorPrimary,
          active: s.active,
          sortOrder: s.sortOrder,
          hasAiConfig: !!s.aiConfig,
          barbershopCount: s._count.barbershops,
        }))}
      />
    </div>
  );
}
