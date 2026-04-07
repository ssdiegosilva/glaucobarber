"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";

const TIER_LABELS: Record<string, { label: string; color: string }> = {
  FREE:  { label: "Free",          color: "text-muted-foreground border-border/60" },
  TRIAL: { label: "Trial",         color: "text-emerald-400 border-emerald-400/30" },
  PRO:   { label: "Profissional",  color: "text-gold-400 border-gold-500/30" },
};

interface Feature {
  key: string;
  label: string;
  description: string;
}

interface Props {
  matrix:     Record<string, Record<string, boolean>>;
  features:   Feature[];
  planTiers:  string[];
}

export function FeaturesClient({ matrix: initialMatrix, features, planTiers }: Props) {
  const [matrix, setMatrix] = useState(initialMatrix);
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState<string | null>(null); // "feature:tier"

  async function toggle(feature: string, planTier: string) {
    const current = matrix[feature]?.[planTier] ?? true;
    const enabled = !current;
    const key = `${feature}:${planTier}`;

    setSaving(key);
    // Optimistic update
    setMatrix((prev) => ({
      ...prev,
      [feature]: { ...prev[feature], [planTier]: enabled },
    }));

    try {
      const res = await fetch("/api/admin/features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature, planTier, enabled }),
      });
      if (!res.ok) {
        // Revert on error
        setMatrix((prev) => ({
          ...prev,
          [feature]: { ...prev[feature], [planTier]: current },
        }));
      }
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="rounded-xl border border-border/60 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60 bg-surface-900">
            <th className="text-left px-5 py-3 font-medium text-muted-foreground w-56">Funcionalidade</th>
            {planTiers.map((tier) => (
              <th key={tier} className="text-center px-4 py-3 font-medium">
                <Badge variant="outline" className={`text-[11px] ${TIER_LABELS[tier]?.color ?? ""}`}>
                  {TIER_LABELS[tier]?.label ?? tier}
                </Badge>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {features.map((f, i) => (
            <tr
              key={f.key}
              className={`border-b border-border/30 transition-colors hover:bg-surface-800/40 ${
                i % 2 === 0 ? "bg-transparent" : "bg-surface-900/30"
              }`}
            >
              <td className="px-5 py-3">
                <p className="font-medium text-foreground">{f.label}</p>
                <p className="text-[11px] text-muted-foreground">{f.description}</p>
              </td>
              {planTiers.map((tier) => {
                const enabled = matrix[f.key]?.[tier] ?? true;
                const key = `${f.key}:${tier}`;
                const isSaving = saving === key;

                return (
                  <td key={tier} className="text-center px-4 py-3">
                    <button
                      onClick={() => toggle(f.key, tier)}
                      disabled={isSaving}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none
                        ${enabled ? "bg-gold-500" : "bg-surface-700"}
                        ${isSaving ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                      `}
                      aria-label={`${enabled ? "Desativar" : "Ativar"} ${f.label} para ${tier}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
                          ${enabled ? "translate-x-6" : "translate-x-1"}`}
                      />
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
