"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, TrendingUp, Loader2 } from "lucide-react";
import { MensalView } from "./views/mensal-view";
import { AnualView }  from "./views/anual-view";
import type { MonthlyData } from "@/lib/financeiro/monthly-data";

type View = "mensal" | "anual";

interface Props {
  initialData:  MonthlyData;
  currentMonth: number;
  currentYear:  number;
}

async function fetchMonthly(month: number, year: number): Promise<MonthlyData> {
  const res = await fetch(`/api/financeiro/monthly?month=${month}&year=${year}`);
  if (!res.ok) throw new Error("Erro ao carregar dados mensais");
  return res.json();
}

async function fetchAnnual(year: number) {
  const res = await fetch(`/api/financeiro/annual?year=${year}&includePrevYear=true`);
  if (!res.ok) throw new Error("Erro ao carregar dados anuais");
  return res.json();
}

export function FinanceiroClient({ initialData, currentMonth, currentYear }: Props) {
  const [view,         setView]         = useState<View>("mensal");
  const [monthNav,     setMonthNav]     = useState({ month: currentMonth, year: currentYear });
  const [annualYear,   setAnnualYear]   = useState(currentYear);

  // ── Mensal query ───────────────────────────────────────────────
  const isCurrentMonth = monthNav.month === currentMonth && monthNav.year === currentYear;

  const monthlyQuery = useQuery<MonthlyData>({
    queryKey:        ["financeiro-monthly", monthNav.month, monthNav.year],
    queryFn:         () => fetchMonthly(monthNav.month, monthNav.year),
    enabled:         !isCurrentMonth,
    staleTime:       5 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const mensalData = isCurrentMonth ? initialData : (monthlyQuery.data ?? initialData);
  const mensalLoading = !isCurrentMonth && monthlyQuery.isFetching;

  // ── Annual query ───────────────────────────────────────────────
  const annualQuery = useQuery({
    queryKey:        ["financeiro-annual", annualYear],
    queryFn:         () => fetchAnnual(annualYear),
    enabled:         view === "anual",
    staleTime:       5 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

  return (
    <div className="space-y-5">
      {/* ── View toggle ──────────────────────────────────── */}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-800/50 p-1 w-fit">
        <button
          onClick={() => setView("mensal")}
          className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-medium transition-colors
            ${view === "mensal"
              ? "bg-gold-500/15 text-gold-400 border border-gold-500/20"
              : "text-muted-foreground hover:text-foreground"}`}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          Mensal
        </button>
        <button
          onClick={() => setView("anual")}
          className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-medium transition-colors
            ${view === "anual"
              ? "bg-gold-500/15 text-gold-400 border border-gold-500/20"
              : "text-muted-foreground hover:text-foreground"}`}
        >
          <TrendingUp className="h-3.5 w-3.5" />
          Anual
        </button>
      </div>

      {/* ── Mensal ───────────────────────────────────────── */}
      {view === "mensal" && (
        <MensalView
          data={mensalData}
          currentMonth={currentMonth}
          currentYear={currentYear}
          isLoading={mensalLoading}
          onNavigate={(month, year) => setMonthNav({ month, year })}
        />
      )}

      {/* ── Anual ────────────────────────────────────────── */}
      {view === "anual" && (
        annualQuery.isLoading && !annualQuery.data ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : annualQuery.data ? (
          <AnualView
            data={annualQuery.data}
            currentMonth={currentMonth}
            currentYear={currentYear}
            isLoading={annualQuery.isFetching}
            onNavigate={setAnnualYear}
          />
        ) : annualQuery.isError ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Erro ao carregar dados anuais. Tente novamente.
          </div>
        ) : null
      )}
    </div>
  );
}
