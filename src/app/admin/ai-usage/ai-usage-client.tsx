"use client";

import { Brain } from "lucide-react";

type Row = { barbershopId: string; barbershopName: string; yearMonth: string; usageCount: number; planTier: string; limit: number; aiCredits: number };

const PLAN_COLOR: Record<string, string> = {
  FREE: "text-zinc-400", STARTER: "text-blue-400", PRO: "text-gold-400", ENTERPRISE: "text-purple-400",
};

function UsageBar({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min((used / limit) * 100, 100);
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-yellow-500" : "bg-green-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-surface-700 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-16 text-right">{used}/{limit === 9999 ? "∞" : limit}</span>
    </div>
  );
}

export function AiUsageClient({ data, yearMonth }: { data: Row[]; yearMonth: string }) {
  const total = data.reduce((s, r) => s + r.usageCount, 0);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Uso de IA</h1>
          <p className="text-sm text-muted-foreground">{yearMonth} · {total} calls totais na plataforma</p>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-800 border-b border-border">
            <tr>
              {["Barbearia", "Plano", "Uso / Limite", "Créditos extras", "% usado"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((r) => {
              const pct = Math.min(Math.round((r.usageCount / r.limit) * 100), 100);
              return (
                <tr key={r.barbershopId} className="hover:bg-surface-800/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Brain className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium text-foreground">{r.barbershopName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold ${PLAN_COLOR[r.planTier]}`}>{r.planTier}</span>
                  </td>
                  <td className="px-4 py-3 min-w-40">
                    <UsageBar used={r.usageCount} limit={r.limit} />
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">{r.aiCredits > 0 ? `+${r.aiCredits}` : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-semibold ${pct >= 90 ? "text-red-400" : pct >= 70 ? "text-yellow-400" : "text-green-400"}`}>
                      {r.limit === 9999 ? "∞" : `${pct}%`}
                    </span>
                  </td>
                </tr>
              );
            })}
            {data.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">Nenhum uso registrado este mês.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
