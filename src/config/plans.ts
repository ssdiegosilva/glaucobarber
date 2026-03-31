export const PLAN_FEATURES = {
  STARTER: {
    ai_suggestions_per_month: 5,
    sync_manual:              true,
    sync_auto:                false,
    campaigns:                false,
    offers:                   false,
    multi_user:               false,
    max_users:                1,
  },
  PRO: {
    ai_suggestions_per_month: Infinity,
    sync_manual:              true,
    sync_auto:                true,
    campaigns:                true,
    offers:                   true,
    multi_user:               true,
    max_users:                3,
  },
  ENTERPRISE: {
    ai_suggestions_per_month: Infinity,
    sync_manual:              true,
    sync_auto:                true,
    campaigns:                true,
    offers:                   true,
    multi_user:               true,
    max_users:                Infinity,
  },
} as const;
