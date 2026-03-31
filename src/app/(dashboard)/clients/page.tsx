import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { formatBRL, relativeTime, getInitials } from "@/lib/utils";
import { Users, Star, Clock, TrendingUp } from "lucide-react";

const STATUS_LABEL = { ACTIVE: "Ativo", INACTIVE: "Inativo", VIP: "VIP", BLOCKED: "Bloqueado" };
const STATUS_VARIANT = { ACTIVE: "success", INACTIVE: "warning", VIP: "default", BLOCKED: "destructive" } as const;

export default async function ClientsPage() {
  const session = await auth();
  if (!session?.user?.barbershopId) redirect("/onboarding");

  const customers = await prisma.customer.findMany({
    where:   { barbershopId: session.user.barbershopId },
    orderBy: [{ status: "asc" }, { lastVisitAt: "desc" }],
    take:    100,
  });

  const vipCount      = customers.filter((c) => c.status === "VIP").length;
  const inactiveCount = customers.filter((c) => c.status === "INACTIVE").length;
  const totalRevenue  = customers.reduce((s, c) => s + Number(c.totalSpent), 0);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Clientes"
        subtitle={`${customers.length} clientes sincronizados da Trinks`}
        userName={session.user.name}
      />

      <div className="p-6 space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard icon={<Users />}     label="Total"    value={customers.length} />
          <StatCard icon={<Star />}      label="VIP"      value={vipCount} />
          <StatCard icon={<Clock />}     label="Inativos" value={inactiveCount} valueClass="text-yellow-400" />
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-800/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Visitas</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Total gasto</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Última visita</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-500/15 border border-gold-500/20 text-xs font-bold text-gold-400 shrink-0">
                          {getInitials(c.name)}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{c.name}</p>
                          {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[c.status] as never}>
                        {STATUS_LABEL[c.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-foreground font-medium tabular-nums">{c.totalVisits}</td>
                    <td className="px-4 py-3 text-foreground tabular-nums">{formatBRL(Number(c.totalSpent))}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {c.lastVisitAt ? relativeTime(c.lastVisitAt) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {c.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="text-[10px] rounded-full bg-surface-700 px-2 py-0.5 text-muted-foreground">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, valueClass = "text-foreground" }: {
  icon: React.ReactNode; label: string; value: number; valueClass?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-4">
      <div className="text-gold-400">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold tabular-nums ${valueClass}`}>{value}</p>
      </div>
    </div>
  );
}
