import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { formatBRL, relativeTime, getInitials } from "@/lib/utils";
import { Users, Star, Clock } from "lucide-react";
import Link from "next/link";

const STATUS_LABEL   = { ACTIVE: "Ativo", INACTIVE: "Inativo", VIP: "VIP", BLOCKED: "Bloqueado" };
const STATUS_VARIANT = { ACTIVE: "success", INACTIVE: "warning", VIP: "default", BLOCKED: "destructive" } as const;

const PS_LABEL:   Record<string, string> = { RECENTE: "Recente", EM_RISCO: "Em risco", INATIVO: "Inativo", REATIVADO: "Reativado", NAO_CONTATAR: "Não contatar" };
const PS_VARIANT: Record<string, string> = { RECENTE: "success", EM_RISCO: "warning", INATIVO: "destructive", REATIVADO: "default", NAO_CONTATAR: "outline" };

const PAGE_SIZE = 100;

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.barbershopId) redirect("/onboarding");

  const { page: pageParam, q } = await searchParams;
  const page  = Math.max(1, parseInt(pageParam ?? "1"));
  const skip  = (page - 1) * PAGE_SIZE;
  const where = {
    barbershopId: session.user.barbershopId,
    ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
  };

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: [{ status: "asc" }, { lastVisitAt: "desc" }],
      take:    PAGE_SIZE,
      skip,
    }),
    prisma.customer.count({ where }),
  ]);

  const totalPages    = Math.ceil(total / PAGE_SIZE);
  const vipCount      = await prisma.customer.count({ where: { barbershopId: session.user.barbershopId, status: "VIP" } });
  const inactiveCount = await prisma.customer.count({ where: { barbershopId: session.user.barbershopId, status: "INACTIVE" } });

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Clientes"
        subtitle={`${total} clientes sincronizados da Trinks`}
        userName={session.user.name}
      />

      <div className="p-6 space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard icon={<Users />} label="Total"    value={total} />
          <StatCard icon={<Star />}  label="VIP"      value={vipCount} />
          <StatCard icon={<Clock />} label="Inativos" value={inactiveCount} valueClass="text-yellow-400" />
        </div>

        {/* Search */}
        <form method="GET">
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome..."
            className="w-full max-w-sm rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </form>

        {/* Table */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="border-b border-border bg-surface-800/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-[52%]">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-[18%]">Telefone</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-[10%]">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-[12%]">Pós-venda</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-[8%]">Visitas</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-[12%]">Total gasto</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-[12%]">Última visita</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-[20%]">Tags</th>
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
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate max-w-[170px] sm:max-w-[220px] md:max-w-[260px] lg:max-w-[320px]">
                            {c.name}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <span className="block truncate max-w-[120px]">{c.phone ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[c.status] as never}>
                        {STATUS_LABEL[c.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {c.postSaleStatus ? (
                        <Badge variant={PS_VARIANT[c.postSaleStatus] as never}>
                          {PS_LABEL[c.postSaleStatus] ?? c.postSaleStatus}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-xs text-muted-foreground">
                {skip + 1}–{Math.min(skip + PAGE_SIZE, total)} de {total}
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={`?page=${page - 1}${q ? `&q=${q}` : ""}`}
                    className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-surface-800 transition-colors"
                  >
                    Anterior
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={`?page=${page + 1}${q ? `&q=${q}` : ""}`}
                    className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-surface-800 transition-colors"
                  >
                    Próxima
                  </Link>
                )}
              </div>
            </div>
          )}
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
