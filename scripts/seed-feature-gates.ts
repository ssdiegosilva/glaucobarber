/**
 * Seed default PlanFeatureGate matrix.
 * Run: npx ts-node --project tsconfig.scripts.json scripts/seed-feature-gates.ts
 *   or: npx tsx scripts/seed-feature-gates.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FEATURES = [
  "dashboard",
  "agenda",
  "copilot",
  "financeiro",
  "meta",
  "clients",
  "services",
  "offers",
  "campaigns",
  "whatsapp",
  "post-sale",
  "integrations",
  "settings",
  "billing",
];

const PLANS = ["FREE", "TRIAL", "STARTER", "PRO"];

// By default everything is enabled, except:
const DISABLED: Record<string, string[]> = {
  FREE:     ["financeiro", "meta"],
  TRIAL:    [],
  STARTER:  ["financeiro"],
  PRO:      [],
};

async function main() {
  let created = 0;
  let skipped = 0;

  for (const planTier of PLANS) {
    for (const feature of FEATURES) {
      const enabled = !DISABLED[planTier]?.includes(feature);
      const result = await prisma.planFeatureGate.upsert({
        where:  { feature_planTier: { feature, planTier } },
        update: {},  // don't overwrite existing admin changes
        create: { feature, planTier, enabled },
      });
      if (result) created++;
      else skipped++;
    }
  }

  console.log(`✓ Seeded ${FEATURES.length * PLANS.length} feature gates (${created} upserted, ${skipped} skipped)`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
