"use client";

import { useState, useEffect } from "react";
import { Settings } from "lucide-react";
import {
  CARD_BRANDS,
  CARD_BRAND_LABELS,
  PAYMENT_TYPES,
  PAYMENT_TYPE_LABELS,
  type CardBrand,
  type CardPaymentType,
  type CardFeeConfigRow,
  calculateMachineFee,
} from "@/lib/card-fees";
import { formatBRL } from "@/lib/utils";

interface Props {
  cardBrand: string | null;
  cardPaymentType: string | null;
  onBrandChange: (brand: string) => void;
  onPaymentTypeChange: (type: string) => void;
  paidValue: number;
}

export function CardDetailsPicker({
  cardBrand,
  cardPaymentType,
  onBrandChange,
  onPaymentTypeChange,
  paidValue,
}: Props) {
  const [feeConfigs, setFeeConfigs] = useState<CardFeeConfigRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/settings/card-fees")
      .then((r) => r.json())
      .then((d) => { setFeeConfigs(d.configs ?? []); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  const currentFee = feeConfigs.find(
    (c) => c.brand === cardBrand && c.paymentType === cardPaymentType
  );
  const feePercent = currentFee?.feePercent ?? 0;
  const feeValue = paidValue > 0 && feePercent > 0 ? calculateMachineFee(paidValue, feePercent) : 0;

  const hasConfigs = feeConfigs.length > 0;

  // Available payment types for selected brand
  const brandTypes = cardBrand
    ? PAYMENT_TYPES.filter((pt) =>
        feeConfigs.some((c) => c.brand === cardBrand && c.paymentType === pt)
      )
    : [];

  // If no configs, show all payment types without fee values
  const displayTypes = hasConfigs ? brandTypes : PAYMENT_TYPES;

  return (
    <div className="space-y-2 pt-1">
      {/* Brand selector */}
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Bandeira</p>
      <div className="flex gap-1.5">
        {CARD_BRANDS.map((brand) => (
          <button
            key={brand}
            type="button"
            onClick={() => {
              onBrandChange(brand);
              // Auto-select CREDIT_1X when changing brand
              onPaymentTypeChange("CREDIT_1X");
            }}
            className={`flex-1 rounded-md border px-2 py-1.5 text-[10px] font-medium transition-colors ${
              cardBrand === brand
                ? "border-gold-500 bg-gold-500/10 text-gold-400"
                : "border-border/60 bg-surface-900 text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            {CARD_BRAND_LABELS[brand]}
          </button>
        ))}
      </div>

      {/* Payment type selector (after brand selected) */}
      {cardBrand && (
        <>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide pt-1">Tipo</p>
          <div className="flex flex-wrap gap-1.5">
            {/* Debit button */}
            <button
              type="button"
              onClick={() => onPaymentTypeChange("DEBIT")}
              className={`rounded-md border px-2.5 py-1.5 text-[10px] font-medium transition-colors ${
                cardPaymentType === "DEBIT"
                  ? "border-gold-500 bg-gold-500/10 text-gold-400"
                  : "border-border/60 bg-surface-900 text-muted-foreground hover:border-border hover:text-foreground"
              }`}
            >
              Debito
            </button>
            {/* Credit installment buttons */}
            {displayTypes.filter((pt) => pt !== "DEBIT").map((pt) => {
              const label = pt === "CREDIT_1X" ? "1x" : pt.replace("CREDIT_", "").replace("X", "x");
              return (
                <button
                  key={pt}
                  type="button"
                  onClick={() => onPaymentTypeChange(pt)}
                  className={`rounded-md border px-2.5 py-1.5 text-[10px] font-medium transition-colors ${
                    cardPaymentType === pt
                      ? "border-gold-500 bg-gold-500/10 text-gold-400"
                      : "border-border/60 bg-surface-900 text-muted-foreground hover:border-border hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Fee preview */}
      {cardBrand && cardPaymentType && (
        <div className="text-[10px] text-muted-foreground pt-0.5">
          {feePercent > 0 ? (
            <span>
              Taxa: <span className="text-yellow-400 font-medium">{feePercent.toFixed(2).replace(".", ",")}%</span>
              {paidValue > 0 && (
                <span> = <span className="text-yellow-400 font-medium">{formatBRL(feeValue)}</span></span>
              )}
            </span>
          ) : loaded && hasConfigs ? (
            <span className="text-muted-foreground">Taxa nao configurada para esta combinacao</span>
          ) : loaded && !hasConfigs ? (
            <a href="/settings?section=card-fees" className="inline-flex items-center gap-1 text-gold-400 hover:underline">
              <Settings className="h-2.5 w-2.5" />
              Configure taxas em Configuracoes
            </a>
          ) : null}
        </div>
      )}
    </div>
  );
}
