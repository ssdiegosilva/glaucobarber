import { getFullFeatureMatrix, ALL_FEATURES, PLAN_TIERS } from "@/lib/access";
import { FeaturesClient } from "./features-client";

export const dynamic = "force-dynamic";

export default async function AdminFeaturesPage() {
  const matrix = await getFullFeatureMatrix();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Funcionalidades por Plano</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure quais recursos estão disponíveis em cada plano. As alterações têm efeito imediato.
        </p>
      </div>

      <FeaturesClient
        matrix={matrix}
        features={ALL_FEATURES.map((f) => ({ key: f.key, label: f.label, description: f.description }))}
        planTiers={[...PLAN_TIERS]}
      />
    </div>
  );
}
