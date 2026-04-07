import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALL_FEATURES = [
  "dashboard", "agenda", "copilot", "financeiro", "meta",
  "clients", "services", "offers", "campaigns", "criar-visual",
  "whatsapp", "whatsapp_auto", "post-sale", "settings", "billing",
] as const;

const TIERS = ["TRIAL", "FREE", "PRO", "ENTERPRISE"] as const;

const BLOCKED: Record<string, string[]> = {
  TRIAL:      [],
  FREE:       ["financeiro", "meta", "whatsapp_auto", "campaigns", "copilot", "post-sale", "criar-visual"],
  PRO:        [],
  ENTERPRISE: [],
};

// POST /api/admin/features/seed — resets all plan feature gates to defaults
export async function POST() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  return NextResponse.json({ ok: true, count });
}
