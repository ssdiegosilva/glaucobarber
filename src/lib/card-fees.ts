// Card brand fee constants — shared between client and server

export const CARD_BRANDS = ["MASTERCARD", "VISA", "ELO", "AMEX"] as const;
export type CardBrand = (typeof CARD_BRANDS)[number];

export const CARD_BRAND_LABELS: Record<CardBrand, string> = {
  MASTERCARD: "Mastercard",
  VISA: "Visa",
  ELO: "Elo",
  AMEX: "Amex",
};

export const PAYMENT_TYPES = [
  "DEBIT",
  "CREDIT_1X",
  "CREDIT_2X",
  "CREDIT_3X",
  "CREDIT_4X",
  "CREDIT_5X",
  "CREDIT_6X",
  "CREDIT_7X",
  "CREDIT_8X",
  "CREDIT_9X",
  "CREDIT_10X",
  "CREDIT_11X",
  "CREDIT_12X",
] as const;
export type CardPaymentType = (typeof PAYMENT_TYPES)[number];

export const PAYMENT_TYPE_LABELS: Record<CardPaymentType, string> = {
  DEBIT: "Debito",
  CREDIT_1X: "Credito a vista",
  CREDIT_2X: "Credito 2x",
  CREDIT_3X: "Credito 3x",
  CREDIT_4X: "Credito 4x",
  CREDIT_5X: "Credito 5x",
  CREDIT_6X: "Credito 6x",
  CREDIT_7X: "Credito 7x",
  CREDIT_8X: "Credito 8x",
  CREDIT_9X: "Credito 9x",
  CREDIT_10X: "Credito 10x",
  CREDIT_11X: "Credito 11x",
  CREDIT_12X: "Credito 12x",
};

export function installmentsFromType(type: CardPaymentType): number {
  if (type === "DEBIT") return 1;
  return parseInt(type.replace("CREDIT_", "").replace("X", ""));
}

export function paymentTypeFromInstallments(installments: number, isDebit: boolean): CardPaymentType {
  if (isDebit) return "DEBIT";
  return `CREDIT_${installments}X` as CardPaymentType;
}

// Default fees based on typical Brazilian acquirer rates (InfinitePay reference)
export const DEFAULT_FEES: Record<CardBrand, Record<CardPaymentType, number>> = {
  MASTERCARD: {
    DEBIT: 1.98,
    CREDIT_1X: 4.98,
    CREDIT_2X: 10.91,
    CREDIT_3X: 12.29,
    CREDIT_4X: 13.64,
    CREDIT_5X: 14.96,
    CREDIT_6X: 16.25,
    CREDIT_7X: 17.51,
    CREDIT_8X: 18.74,
    CREDIT_9X: 19.94,
    CREDIT_10X: 21.11,
    CREDIT_11X: 22.25,
    CREDIT_12X: 23.36,
  },
  VISA: {
    DEBIT: 1.98,
    CREDIT_1X: 4.98,
    CREDIT_2X: 10.91,
    CREDIT_3X: 12.29,
    CREDIT_4X: 13.64,
    CREDIT_5X: 14.96,
    CREDIT_6X: 16.25,
    CREDIT_7X: 17.51,
    CREDIT_8X: 18.74,
    CREDIT_9X: 19.94,
    CREDIT_10X: 21.11,
    CREDIT_11X: 22.25,
    CREDIT_12X: 23.36,
  },
  ELO: {
    DEBIT: 2.98,
    CREDIT_1X: 6.17,
    CREDIT_2X: 12.10,
    CREDIT_3X: 13.48,
    CREDIT_4X: 14.83,
    CREDIT_5X: 16.15,
    CREDIT_6X: 17.44,
    CREDIT_7X: 18.70,
    CREDIT_8X: 19.93,
    CREDIT_9X: 21.13,
    CREDIT_10X: 22.30,
    CREDIT_11X: 23.44,
    CREDIT_12X: 24.55,
  },
  AMEX: {
    DEBIT: 0,
    CREDIT_1X: 5.79,
    CREDIT_2X: 11.72,
    CREDIT_3X: 13.10,
    CREDIT_4X: 14.45,
    CREDIT_5X: 15.77,
    CREDIT_6X: 17.06,
    CREDIT_7X: 18.32,
    CREDIT_8X: 19.55,
    CREDIT_9X: 20.75,
    CREDIT_10X: 21.92,
    CREDIT_11X: 23.06,
    CREDIT_12X: 24.17,
  },
};

export interface CardFeeConfigRow {
  brand: string;
  paymentType: string;
  feePercent: number;
}

export function calculateMachineFee(paidValue: number, feePercent: number): number {
  return Math.round(paidValue * feePercent) / 100;
}
