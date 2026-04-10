"use client";

import { useState, useEffect } from "react";
import { Settings } from "lucide-react";
import {
  CARD_BRANDS,
  CARD_BRAND_LABELS,
  PAYMENT_TYPES,
  type CardBrand,
  type CardPaymentType,
  type CardFeeConfigRow,
  calculateMachineFee,
} from "@/lib/card-fees";
import { formatBRL } from "@/lib/utils";
import { CardBrandLogo } from "./card-brand-logo";

interface Props {
  cardBrand: string | null;
  cardPaymentType: string | null;
  onBrandChange: (brand: string) => void;
  onPaymentTypeChange: (type: string) => void;
  paidValue: number;
}

const CREDIT_TYPES = PAYMENT_TYPES.filter((pt) => pt !== "DEBIT");

export function CardDetailsPicker({
  cardBrand,
  cardPaymentType,
  onBrandChange,
  onPaymentTypeChange,
  paidValue,
}: Props) {
  const [feeConfigs, setFeeConfigs] = useState<CardFeeConfigRow[]>([]);
  const [loaded, setLoaded]         = useState(false);

  useEffect(() => {
    fetch("/api/settings/card-fees")
      .then((r) => r.json())
      .then((d) => { setFeeConfigs(d.configs ?? []); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  const currentFee  = feeConfigs.find((c) => c.brand === cardBrand && c.paymentType === cardPaymentType);
  const feePercent  = currentFee?.feePercent ?? 0;
  const feeValue    = paidValue > 0 && feePercent > 0 ? calculateMachineFee(paidValue, feePercent) : 0;
  const hasConfigs  = feeConfigs.length > 0;

  // Which credit installments are configured for the selected brand
  const availableCredit = cardBrand
    ? CREDIT_TYPES.filter((pt) =>
        !hasConfigs || feeConfigs.some((c) => c.brand === cardBrand && c.paymentType === pt)
      )
    : CREDIT_TYPES;

  const isDebit  = cardPaymentType === "DEBIT";
  const isCredit = cardPaymentType !== null && cardPaymentType !== "DEBIT";

  function selectDebit() {
    onPaymentTypeChange("DEBIT");
  }

  function selectCredit() {
    // Default to 1x when switching to credit
    if (!isCredit) onPaymentTypeChange("CREDIT_1X");
  }

  return (
    <div className="space-y-3 pt-1">
      {/* Step 1 — Brand */}
      <div className="space-y-1.5">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Bandeira</p>
        <div className="flex gap-1.5">
          {CARD_BRANDS.map((brand) => (
            <button
              key={brand}
              type="button"
              onClick={() => {
                onBrandChange(brand);
                if (!cardPaymentType) onPaymentTypeChange("CREDIT_1X");
              }}
              className={`flex-1 rounded-md border px-2 py-2 flex flex-col items-center gap-1 transition-colors ${
                cardBrand === brand
                  ? "border-gold-500 bg-gold-500/10"
                  : "border-border/60 bg-surface-900 hover:border-border"
              }`}
            >
              <CardBrandLogo brand={brand} size={22} />
              <span className={`text-[9px] font-medium ${cardBrand === brand ? "text-gold-400" : "text-muted-foreground"}`}>
                {CARD_BRAND_LABELS[brand as CardBrand]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Step 2 — Débito ou Crédito */}
      {cardBrand && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Modalidade</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={selectDebit}
              className={`rounded-md border px-3 py-2.5 text-xs font-semibold transition-colors ${
                isDebit
                  ? "border-gold-500 bg-gold-500/10 text-gold-400"
                  : "border-border/60 bg-surface-900 text-muted-foreground hover:border-border hover:text-foreground"
              }`}
            >
              Débito
            </button>
            <button
              type="button"
              onClick={selectCredit}
              className={`rounded-md border px-3 py-2.5 text-xs font-semibold transition-colors ${
                isCredit
                  ? "border-gold-500 bg-gold-500/10 text-gold-400"
                  : "border-border/60 bg-surface-900 text-muted-foreground hover:border-border hover:text-foreground"
              }`}
            >
              Crédito
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Parcelas (só para crédito) */}
      {cardBrand && isCredit && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Parcelas</p>
          <div className="flex flex-wrap gap-1.5">
            {availableCredit.map((pt) => {
              const label = pt === "CREDIT_1X" ? "1x (à vista)" : pt.replace("CREDIT_", "").replace("X", "x");
              const fee   = feeConfigs.find((c) => c.brand === cardBrand && c.paymentType === pt);
              return (
                <button
                  key={pt}
                  type="button"
                  onClick={() => onPaymentTypeChange(pt)}
                  className={`rounded-md border px-2.5 py-1.5 text-[10px] font-medium transition-colors text-left ${
                    cardPaymentType === pt
                      ? "border-gold-500 bg-gold-500/10 text-gold-400"
                      : "border-border/60 bg-surface-900 text-muted-foreground hover:border-border hover:text-foreground"
                  }`}
                >
                  <span className="block">{label}</span>
                  {fee && (
                    <span className={`block text-[9px] ${cardPaymentType === pt ? "text-gold-400/70" : "text-muted-foreground/60"}`}>
                      {fee.feePercent.toFixed(2).replace(".", ",")}%
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Fee preview */}
      {cardBrand && cardPaymentType && (
        <div className="text-[10px] text-muted-foreground">
          {feePercent > 0 ? (
            <span>
              Taxa: <span className="text-yellow-400 font-medium">{feePercent.toFixed(2).replace(".", ",")}%</span>
              {paidValue > 0 && (
                <span> = <span className="text-yellow-400 font-medium">{formatBRL(feeValue)}</span></span>
              )}
            </span>
          ) : loaded && hasConfigs ? (
            <span>Taxa não configurada para esta combinação</span>
          ) : loaded && !hasConfigs ? (
            <a href="/settings?section=card-fees" className="inline-flex items-center gap-1 text-gold-400 hover:underline">
              <Settings className="h-2.5 w-2.5" />
              Configure taxas em Configurações
            </a>
          ) : null}
        </div>
      )}
    </div>
  );
}
