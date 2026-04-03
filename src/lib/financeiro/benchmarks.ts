export const BENCHMARKS = {
  avgTicket:      { min: 55,   max: 90  },  // R$ — barbearia brasileira
  conversionRate: { good: 0.80, warning: 0.65 },
  revenuePerDay:  { min: 300,  max: 700 },  // R$ por dia útil, cadeira única
  comboMixPct:    { good: 0.30 },           // COMBO ≥ 30% = upsell saudável
  discountRate:   { warning: 0.10, bad: 0.20 }, // > 20% = alerta vermelho
} as const;

export type BenchmarkStatus = "good" | "warning" | "bad" | "neutral";

export function avgTicketStatus(value: number): BenchmarkStatus {
  if (value >= BENCHMARKS.avgTicket.min && value <= BENCHMARKS.avgTicket.max) return "good";
  if (value > BENCHMARKS.avgTicket.max) return "good"; // acima do max = ótimo
  if (value >= BENCHMARKS.avgTicket.min * 0.8) return "warning";
  return "bad";
}

export function conversionStatus(value: number): BenchmarkStatus {
  if (value >= BENCHMARKS.conversionRate.good) return "good";
  if (value >= BENCHMARKS.conversionRate.warning) return "warning";
  return "bad";
}

export function revenuePerDayStatus(value: number): BenchmarkStatus {
  if (value >= BENCHMARKS.revenuePerDay.min) return "good";
  if (value >= BENCHMARKS.revenuePerDay.min * 0.6) return "warning";
  return "bad";
}

export function discountRateStatus(value: number): BenchmarkStatus {
  if (value >= BENCHMARKS.discountRate.bad) return "bad";
  if (value >= BENCHMARKS.discountRate.warning) return "warning";
  return "good";
}
