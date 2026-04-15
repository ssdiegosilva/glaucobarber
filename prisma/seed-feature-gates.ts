// ============================================================
// Seed default plan feature gates
// Run: npx tsx prisma/seed-feature-gates.ts
// ============================================================
// Defines which features each plan tier can access.
// Uses upsert so it's safe to run multiple times.
// ============================================================

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// All features from src/lib/access.ts
const ALL_FEATURES = [
  "dashboard",
  "agenda",
  "copilot",
  "financeiro",
  "meta",
  "clients",
  "services",
  "campaigns",
  "criar-visual",
  "whatsapp",
  "whatsapp_auto",
  "post-sale",
  "settings",
  "billing",
] as const;

const TIERS = ["TRIAL", "FREE", "PRO", "ENTERPRISE"] as const;

// Features blocked per tier (everything else is allowed)
const BLOCKED: Record<string, string[]> = {
  TRIAL:      [],  // trial = acesso total (simula PRO)
  FREE:       ["financeiro", "meta", "whatsapp_auto", "campaigns", "copilot", "post-sale", "criar-visual"],
  PRO:        [],
  ENTERPRISE: [],
};

async function main() {
  console.log("Seeding plan feature gates...");

  let count = 0;
  for (const tier of TIERS) {
    const blocked = BLOCKED[tier] ?? [];
    for (const feature of ALL_FEATURES) {
      const enabled = !blocked.includes(feature);
      await prisma.planFeatureGate.upsert({
        where:  { feature_planTier: { feature, planTier: tier } },
        update: { enabled },
        create: { feature, planTier: tier, enabled },
      });
      count++;
    }
  }

  console.log(`Done — ${count} gates upserted.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
