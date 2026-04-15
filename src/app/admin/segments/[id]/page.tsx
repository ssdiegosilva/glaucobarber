import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ALL_FEATURES } from "@/lib/access";

// Keys that don't correspond to NAV items — they are feature gates, not menu modules
const NON_NAV_KEYS = new Set(["whatsapp_auto", "settings", "billing"]);
import { SegmentForm } from "./segment-form";

export const dynamic = "force-dynamic";

export default async function AdminSegmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const segment = await prisma.segment.findUnique({
    where: { id },
    include: { aiConfig: true, _count: { select: { barbershops: true } } },
  });

  if (!segment) {
    notFound();
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Editar segmento: {segment.displayName}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {segment._count.barbershops} estabelecimento(s) usando este segmento.
        </p>
      </div>

      <SegmentForm
        segment={{
          id: segment.id,
          key: segment.key,
          displayName: segment.displayName,
          tenantLabel: segment.tenantLabel,
          description: segment.description,
          icon: segment.icon,
          colorPrimary:    segment.colorPrimary,
          colorBackground: segment.colorBackground,
          colorCard:       segment.colorCard,
          active: segment.active,
          sortOrder: segment.sortOrder,
          availableModules: segment.availableModules,
          serviceCategories: segment.serviceCategories,
          roles: segment.roles,
          aiConfig: segment.aiConfig
            ? {
                copilotSystemPrompt: segment.aiConfig.copilotSystemPrompt,
                suggestionsSystemPrompt: segment.aiConfig.suggestionsSystemPrompt,
                campaignTextSystemPrompt: segment.aiConfig.campaignTextSystemPrompt,
                brandStyleSystemPrompt: segment.aiConfig.brandStyleSystemPrompt,
                serviceAnalysisSystemPrompt: segment.aiConfig.serviceAnalysisSystemPrompt,
                vitrineCaptionSystemPrompt: segment.aiConfig.vitrineCaptionSystemPrompt,
                haircutVisualPrompt: segment.aiConfig.haircutVisualPrompt,
                featureCosts: segment.aiConfig.featureCosts,
                imageFeatures: segment.aiConfig.imageFeatures,
              }
            : null,
        }}
        allFeatures={ALL_FEATURES.filter((f) => !NON_NAV_KEYS.has(f.key)).map((f) => ({ key: f.key, label: f.label }))}
      />
    </div>
  );
}
