// Simple env-based feature flags (global)
// Per-tenant flags are stored in FeatureFlag table

export const FLAGS = {
  AI_SUGGESTIONS:      process.env.FEATURE_AI_SUGGESTIONS      !== "false",
  CAMPAIGNS:           process.env.FEATURE_CAMPAIGNS           !== "false",
  OFFERS:              process.env.FEATURE_OFFERS              !== "false",
  STRIPE_SHOP_OFFERS:  process.env.FEATURE_STRIPE_SHOP_OFFERS  === "true",
  WHATSAPP:            process.env.FEATURE_WHATSAPP            === "true",
  INSTAGRAM:           process.env.FEATURE_INSTAGRAM           === "true",
} as const;
