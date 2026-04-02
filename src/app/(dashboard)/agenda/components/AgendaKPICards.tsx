import { formatBRL, formatPercent } from "@/lib/utils";
import { CheckCircle2, XCircle, UserX, TrendingUp, Clock, Calendar } from "lucide-react";

export interface AgendaKPIs {
  revenueCompleted:  number;
  revenueProjected:  number;
  completedCount:    number;
  cancelledCount:    number;
  noShowCount:       number;
  occupancyRate:     number;
  freeSlots:         number;
  totalSlots:        number;
}

export function AgendaKPICards({ kpis }: { kpis: AgendaKPIs }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
      <KPICard
        icon={<TrendingUp className="h-4 w-4" />}
        label="Faturamento realizado"
        value={formatBRL(kpis.revenueCompleted)}
        className="col-span-2 md:col-span-1"
      />
      <KPICard
        icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
        label="Faturamento previsto"
        value={formatBRL(kpis.revenueProjected)}
        valueClass="text-muted-foreground"
      />
      <KPICard
        icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
        label="Concluídos"
        value={String(kpis.completedCount)}
        valueClass="text-emerald-400"
      />
      <KPICard
        icon={<XCircle className="h-4 w-4 text-red-400" />}
        label="Cancelamentos"
        value={String(kpis.cancelledCount)}
        valueClass={kpis.cancelledCount > 0 ? "text-red-400" : undefined}
      />
      <KPICard
        icon={<UserX className="h-4 w-4 text-orange-400" />}
        label="No-show"
        value={String(kpis.noShowCount)}
        valueClass={kpis.noShowCount > 0 ? "text-orange-400" : undefined}
      />
      <KPICard
        icon={<Calendar className="h-4 w-4 text-gold-400" />}
        label="Ocupação"
        value={formatPercent(kpis.occupancyRate)}
        valueClass="text-gold-400"
      />
      <KPICard
        icon={<Clock className="h-4 w-4 text-blue-400" />}
        label="Horários vagos"
        value={`${kpis.freeSlots} / ${kpis.totalSlots}`}
        valueClass="text-blue-400"
      />
    </div>
  );
}

function KPICard({
  icon, label, value, valueClass = "text-foreground", className,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-border/60 bg-surface-900 p-3 ${className ?? ""}`}>
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        {icon}
        <span className="text-[11px] uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}
