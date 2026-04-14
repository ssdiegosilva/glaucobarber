// ============================================================
// Segment — runtime loader for multi-vertical platform
// ============================================================
// Converts a Segment DB record into a VerticalConfig at runtime.
// Uses Next.js unstable_cache with a 5-min TTL so prompts are
// editable by admins without a full redeploy.
// Fallback: barbershopVertical (static code) when DB is unavailable
// or when a barbershop has no segmentId set.
// ============================================================

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { barbershopVertical } from "@/lib/vertical/barbershop/config";
import type { VerticalConfig } from "./vertical";
import type { Segment, SegmentAiConfig } from "@prisma/client";

type SegmentWithAi = Segment & { aiConfig: SegmentAiConfig | null };

// ── Cache key tag shared across all segment lookups ───────────
// Admin edits call invalidateSegmentCache() which revalidates this tag.
export const SEGMENT_CACHE_TAG = "segment";

// ── Main loader: full VerticalConfig with AI prompts ──────────
// Used by AI routes that need the system prompts.
export const getSegmentForBarbershop = unstable_cache(
  async (barbershopId: string): Promise<VerticalConfig> => {
    try {
      const shop = await prisma.barbershop.findUnique({
        where: { id: barbershopId },
        select: { segmentId: true },
      });

      if (!shop?.segmentId) return barbershopVertical;

      const seg = await prisma.segment.findUnique({
        where: { id: shop.segmentId, active: true },
        include: { aiConfig: true },
      });

      if (!seg) {
        console.warn(`[segment] Segment ${shop.segmentId} not found or inactive for barbershop ${barbershopId}, falling back to barbershop vertical`);
        return barbershopVertical;
      }

      return segmentToVerticalConfig(seg);
    } catch {
      // DB failure: fall back to static config so the app stays functional
      return barbershopVertical;
    }
  },
  ["segment-for-barbershop"],
  { revalidate: 300, tags: [SEGMENT_CACHE_TAG] }
);

// ── Theme loader: visual data only (no AI prompts) ────────────
// Used by dashboard layout — lighter query, no cache needed since
// layout is already a server component with its own request scope.
export async function getSegmentTheme(barbershopId: string): Promise<{
  colorPrimary:    string;
  colorBackground: string;
  colorCard:       string;
  icon:            string | null;
  displayName:     string;
  availableModules: string;
} | null> {
  try {
    const shop = await prisma.barbershop.findUnique({
      where: { id: barbershopId },
      select: {
        segment: {
          select: {
            colorPrimary:    true,
            colorBackground: true,
            colorCard:       true,
            icon:            true,
            displayName:     true,
            availableModules: true,
          },
        },
      },
    });
    return shop?.segment ?? null;
  } catch {
    return null;
  }
}

// ── Cache invalidation ────────────────────────────────────────
// Call after admin edits segment prompts or theme.
export async function invalidateSegmentCache(): Promise<void> {
  const { revalidateTag } = await import("next/cache");
  revalidateTag(SEGMENT_CACHE_TAG);
}

// ── Converter: Segment DB record → VerticalConfig ─────────────
function segmentToVerticalConfig(seg: SegmentWithAi): VerticalConfig {
  const ai = seg.aiConfig;

  // Parse JSON fields with safe fallbacks
  let featureCosts: Record<string, number> = {};
  let imageFeatures: string[] = [];
  let rolesData: Array<{ key: string; label: string }> = [];

  try {
    featureCosts = ai?.featureCosts ? JSON.parse(ai.featureCosts) : {};
  } catch { /* use default */ }

  try {
    imageFeatures = ai?.imageFeatures ? JSON.parse(ai.imageFeatures) : [];
  } catch { /* use default */ }

  try {
    rolesData = seg.roles ? JSON.parse(seg.roles) : [];
  } catch { /* use default */ }

  const professionalRole = rolesData[0]?.key ?? "BARBER";
  const availableRoles = rolesData.map((r) => r.key);
  if (!availableRoles.includes("OWNER")) availableRoles.unshift("OWNER");
  if (!availableRoles.includes("STAFF")) availableRoles.push("STAFF");

  return {
    id: seg.key,
    displayName: seg.displayName,
    tenantLabel: seg.tenantLabel,

    billing: {
      // Feature gates are global to the platform (plan-based), not per-segment
      featureGates: barbershopVertical.billing.featureGates,
    },

    ai: {
      featureCosts:
        Object.keys(featureCosts).length > 0
          ? featureCosts
          : barbershopVertical.ai.featureCosts,
      // featureLabels are global UI strings — not per-segment
      featureLabels: barbershopVertical.ai.featureLabels,
      imageFeatures:
        imageFeatures.length > 0
          ? imageFeatures
          : barbershopVertical.ai.imageFeatures,

      // AI prompts: use DB value or fallback to barbershop static
      copilotSystemPrompt:
        ai?.copilotSystemPrompt || barbershopVertical.ai.copilotSystemPrompt,
      suggestionsSystemPrompt:
        ai?.suggestionsSystemPrompt || barbershopVertical.ai.suggestionsSystemPrompt,
      campaignTextSystemPrompt:
        ai?.campaignTextSystemPrompt || barbershopVertical.ai.campaignTextSystemPrompt,
      brandStyleSystemPrompt:
        ai?.brandStyleSystemPrompt || barbershopVertical.ai.brandStyleSystemPrompt,
      serviceAnalysisSystemPrompt:
        ai?.serviceAnalysisSystemPrompt ||
        barbershopVertical.ai.serviceAnalysisSystemPrompt,
      haircutVisualPrompt:
        ai?.haircutVisualPrompt || barbershopVertical.ai.haircutVisualPrompt,
      vitrineCaptionSystemPrompt:
        ai?.vitrineCaptionSystemPrompt ||
        barbershopVertical.ai.vitrineCaptionSystemPrompt,
    },

    storage: {
      bucketName: barbershopVertical.storage.bucketName,
    },

    messaging: {
      defaultCountryCode: "55",
    },

    roles: {
      available: availableRoles,
      professionalRole,
    },
  };
}
