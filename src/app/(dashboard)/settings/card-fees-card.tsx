"use client";

import { useState } from "react";
import { Loader2, RotateCcw, Check } from "lucide-react";
import {
  CARD_BRANDS,
  CARD_BRAND_LABELS,
  PAYMENT_TYPES,
  PAYMENT_TYPE_LABELS,
  DEFAULT_FEES,
  type CardBrand,
  type CardPaymentType,
  type CardFeeConfigRow,
} from "@/lib/card-fees";

interface Props {
  initialConfigs: CardFeeConfigRow[];
}

type FeeMap = Record<string, Record<string, number>>;

function buildFeeMap(configs: CardFeeConfigRow[]): FeeMap {
  const map: FeeMap = {};
  for (const c of configs) {
    if (!map[c.brand]) map[c.brand] = {};
    map[c.brand][c.paymentType] = c.feePercent;
  }
  return map;
}

function feeMapToConfigs(map: FeeMap): CardFeeConfigRow[] {
  const out: CardFeeConfigRow[] = [];
  for (const brand of Object.keys(map)) {
    for (const pt of Object.keys(map[brand])) {
      const val = map[brand][pt];
      if (val > 0) out.push({ brand, paymentType: pt, feePercent: val });
    }
  }
  return out;
}

export function CardFeesCard({ initialConfigs }: Props) {
  const [feeMap, setFeeMap] = useState<FeeMap>(() => buildFeeMap(initialConfigs));
  const [activeBrand, setActiveBrand] = useState<CardBrand>(CARD_BRANDS[0]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function getRate(brand: string, pt: string): string {
    const val = feeMap[brand]?.[pt];
    return val != null ? val.toString().replace(".", ",") : "";
  }

  function setRate(brand: string, pt: string, raw: string) {
    const normalized = raw.replace(",", ".");
    const val = parseFloat(normalized);
    setFeeMap((prev) => ({
      ...prev,
      [brand]: {
        ...(prev[brand] ?? {}),
        [pt]: isNaN(val) ? 0 : Math.round(val * 100) / 100,
      },
    }));
    setSaved(false);
  }

  function loadDefaults() {
    const map: FeeMap = {};
    for (const brand of CARD_BRANDS) {
      map[brand] = {};
      for (const pt of PAYMENT_TYPES) {
        map[brand][pt] = DEFAULT_FEES[brand][pt];
      }
    }
    setFeeMap(map);
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    try {
      const configs = feeMapToConfigs(feeMap);
      const res = await fetch("/api/settings/card-fees", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configs }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  const hasAnyConfig = Object.keys(feeMap).length > 0 &&
    Object.values(feeMap).some((pts) => Object.values(pts).some((v) => v > 0));

  return (
    <div className="space-y-4 pt-2">
      {/* Brand tabs */}
      <div className="flex gap-2">
        {CARD_BRANDS.map((brand) => (
          <button
            key={brand}
            type="button"
            onClick={() => setActiveBrand(brand)}
            className={`flex-1 rounded-lg border px-3 py-2.5 text-xs font-medium transition-colors ${
              activeBrand === brand
                ? "border-gold-500 bg-gold-500/10 text-gold-400"
                : "border-border/60 bg-surface-900 text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            {CARD_BRAND_LABELS[brand]}
          </button>
        ))}
      </div>

      {/* Fee table for active brand */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-surface-800/50">
              <th className="text-left px-3 py-2 text-muted-foreground font-medium">Tipo</th>
              <th className="text-right px-3 py-2 text-muted-foreground font-medium w-28">Taxa (%)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {PAYMENT_TYPES.map((pt) => (
              <tr key={pt} className="hover:bg-surface-800/20">
                <td className="px-3 py-2 text-foreground">
                  {PAYMENT_TYPE_LABELS[pt as CardPaymentType]}
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={getRate(activeBrand, pt)}
                    onChange={(e) => setRate(activeBrand, pt, e.target.value)}
                    placeholder="0,00"
                    className="w-full bg-surface-700 border border-border rounded px-2 py-1 text-xs text-foreground text-right tabular-nums"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={loadDefaults}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
          Usar taxas padrao
        </button>

        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <Check className="h-3 w-3" /> Salvo
            </span>
          )}
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="bg-gold-500 hover:bg-gold-400 text-black font-medium px-4 py-1.5 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar taxas"}
          </button>
        </div>
      </div>

      {!hasAnyConfig && (
        <p className="text-[11px] text-muted-foreground">
          Nenhuma taxa configurada. Clique em &quot;Usar taxas padrao&quot; para carregar valores iniciais.
        </p>
      )}
    </div>
  );
}
