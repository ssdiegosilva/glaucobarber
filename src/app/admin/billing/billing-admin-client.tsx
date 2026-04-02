"use client";

import { Receipt, CheckCircle2, Clock } from "lucide-react";

type Summary = { yearMonth: string; totalCents: number; count: number };
type Event   = { id: string; barbershopName: string; yearMonth: string; amountCents: number; invoicedAt: string | null; createdAt: string };

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export function BillingAdminClient({ summary, events, currentYearMonth }: { summary: Summary[]; events: Event[]; currentYearMonth: string }) {
  const pendingCents   = events.filter((e) => !e.invoicedAt).reduce((s, e) => s + e.amountCents, 0);
  const pendingCount   = events.filter((e) => !e.invoicedAt).length;
  const invoicedCount  = events.filter((e) =>  e.invoicedAt).length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Cobrança PRO</h1>
        <p className="text-sm text-muted-foreground">Atendimentos cobráveis do plano Pro (R$1,50/atendimento)</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="A faturar (mês atual)" value={formatBRL(pendingCents)} sub={`${pendingCount} atend.`} color="text-yellow-400" />
        <StatCard label="Já faturados" value={String(invoicedCount)} sub="este mês" color="text-green-400" />
        {summary[0] && <StatCard label={`Total ${summary[0].yearMonth}`} value={formatBRL(summary[0].totalCents)} sub={`${summary[0].count} atend.`} color="text-foreground" />}
        {summary[1] && <StatCard label={`Total ${summary[1].yearMonth}`} value={formatBRL(summary[1].totalCents)} sub={`${summary[1].count} atend.`} color="text-muted-foreground" />}
      </div>

      {/* Monthly history */}
      <div className="rounded-lg border border-border bg-surface-800/60 p-4">
        <p className="text-sm font-semibold text-foreground mb-3">Histórico mensal</p>
        <div className="space-y-1.5">
          {summary.map((s) => (
            <div key={s.yearMonth} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{s.yearMonth}</span>
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground">{s.count} atendimentos</span>
                <span className="font-semibold text-foreground">{formatBRL(s.totalCents)}</span>
              </div>
            </div>
          ))}
          {summary.length === 0 && <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>}
        </div>
      </div>

      {/* Events table */}
      <div>
        <p className="text-sm font-semibold text-foreground mb-3">Atendimentos de {currentYearMonth}</p>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-800 border-b border-border">
              <tr>
                {["Barbearia", "Valor", "Status", "Data"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {events.map((e) => (
                <tr key={e.id} className="hover:bg-surface-800/40">
                  <td className="px-4 py-2.5 font-medium text-foreground">{e.barbershopName}</td>
                  <td className="px-4 py-2.5 text-foreground">{formatBRL(e.amountCents)}</td>
                  <td className="px-4 py-2.5">
                    {e.invoicedAt
                      ? <span className="inline-flex items-center gap-1 text-green-400 text-xs"><CheckCircle2 className="h-3 w-3" /> Faturado</span>
                      : <span className="inline-flex items-center gap-1 text-yellow-400 text-xs"><Clock className="h-3 w-3" /> Pendente</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {new Date(e.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">Nenhum evento este mês.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-800/60 p-4">
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
