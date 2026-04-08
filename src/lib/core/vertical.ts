// ============================================================
// Vertical Config — SaaS Core
// ============================================================
// Each vertical (barbershop, salon, pet shop, etc.) provides
// its own config. The SaaS core reads from here instead of
// hardcoding domain-specific values.
//
// To add a new vertical:
//   1. Create src/lib/vertical/<name>/config.ts
//   2. Export a VerticalConfig object
//   3. Point ACTIVE_VERTICAL to it
// ============================================================

export interface VerticalConfig {
  /** Unique vertical identifier */
  id: string;
  /** Display name (e.g. "Barbearia", "Salão de Beleza") */
  displayName: string;
  /** Tenant entity name used in UI (e.g. "barbearia", "salão") */
  tenantLabel: string;

  // ── Billing ───────────────────────────────────────────────
  billing: {
    /** Feature keys locked per plan tier */
    featureGates: Record<string, string[]>;
  };

  // ── AI ────────────────────────────────────────────────────
  ai: {
    /** Feature cost multipliers (image features cost more) */
    featureCosts: Record<string, number>;
    /** Human-readable labels for AI features (shown in usage log) */
    featureLabels: Record<string, string>;
    /** Set of features that are image-generation (higher cost) */
    imageFeatures: string[];
    /** System prompt for the copilot */
    copilotSystemPrompt: string;
    /** System prompt for suggestions */
    suggestionsSystemPrompt: string;
    /** System prompt for campaign text generation */
    campaignTextSystemPrompt: string;
    /** System prompt for brand style */
    brandStyleSystemPrompt: string;
    /** System prompt for haircut/service analysis */
    serviceAnalysisSystemPrompt: string;
    /** Prompt sent to gpt-image-1 for the haircut visual transformation */
    haircutVisualPrompt: string;
    /** System prompt for vitrine (work showcase) caption generation */
    vitrineCaptionSystemPrompt: string;
  };

  // ── Storage ───────────────────────────────────────────────
  storage: {
    /** Supabase bucket name */
    bucketName: string;
  };

  // ── Messaging ─────────────────────────────────────────────
  messaging: {
    /** Default country code for phone normalization */
    defaultCountryCode: string;
  };

  // ── Roles ─────────────────────────────────────────────────
  roles: {
    /** Available membership roles for this vertical */
    available: string[];
    /** The "professional" role name (e.g. "BARBER", "STYLIST") */
    professionalRole: string;
  };
}

// ── Active vertical ─────────────────────────────────────────
// Import is lazy to avoid circular deps. The vertical config
// is loaded once and cached.

import { barbershopVertical } from "@/lib/vertical/barbershop/config";

let _activeVertical: VerticalConfig | null = null;

export function getVerticalConfig(): VerticalConfig {
  if (!_activeVertical) {
    // When adding a second vertical, switch on process.env.VERTICAL
    _activeVertical = barbershopVertical;
  }
  return _activeVertical;
}

/** Override the active vertical (useful for tests or multi-vertical setups) */
export function setVerticalConfig(config: VerticalConfig): void {
  _activeVertical = config;
}
