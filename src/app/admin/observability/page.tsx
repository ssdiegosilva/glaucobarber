import { prisma } from "@/lib/prisma";
import { ObservabilityClient } from "./observability-client";

export default async function AdminObservabilityPage() {
  const ago7d  = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000);
  const ago24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [cronErrors, syncErrors, waErrors, cronErrorsTotal, syncErrorsTotal, waErrorsTotal] = await Promise.all([
    // CronRun failures last 7 days
    prisma.cronRun.findMany({
      where:   { status: "failed", ranAt: { gte: ago7d } },
      orderBy: { ranAt: "desc" },
      take:    200,
    }),

    // SyncRun failures last 7 days
    prisma.syncRun.findMany({
      where:   { status: { in: ["FAILED", "PARTIAL"] }, startedAt: { gte: ago7d } },
      include: { barbershop: { select: { name: true } } },
      orderBy: { startedAt: "desc" },
      take:    200,
    }),

    // WhatsApp failures last 7 days
    prisma.whatsappMessage.findMany({
      where:   { status: "FAILED", updatedAt: { gte: ago7d } },
      include: { barbershop: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take:    200,
      select: {
        id:           true,
        barbershopId: true,
        customerName: true,
        phone:        true,
        type:         true,
        errorMessage: true,
        updatedAt:    true,
        barbershop:   { select: { name: true } },
      },
    }),

    // 24h counts for summary cards
    prisma.cronRun.count({ where: { status: "failed", ranAt: { gte: ago24h } } }),
    prisma.syncRun.count({ where: { status: { in: ["FAILED", "PARTIAL"] }, startedAt: { gte: ago24h } } }),
    prisma.whatsappMessage.count({ where: { status: "FAILED", updatedAt: { gte: ago24h } } }),
  ]);

  // Build unified error feed
  const errors = [
    ...cronErrors.map((r) => ({
      id:        r.id,
      source:    "cron" as const,
      title:     `Cron falhou: ${r.cronName}`,
      detail:    r.error ?? null,
      context:   r.durationMs ? `${r.durationMs}ms` : null,
      shop:      null,
      timestamp: r.ranAt.toISOString(),
    })),

    ...syncErrors.map((r) => ({
      id:        r.id,
      source:    "sync" as const,
      title:     `Sync ${r.status}: ${r.barbershop.name}`,
      detail:    r.errorDetails ?? null,
      context:   r.errorsCount > 0 ? `${r.errorsCount} erros` : null,
      shop:      r.barbershop.name,
      timestamp: r.startedAt.toISOString(),
    })),

    ...waErrors.map((r) => ({
      id:        r.id,
      source:    "whatsapp" as const,
      title:     `WhatsApp falhou: ${r.customerName}`,
      detail:    r.errorMessage ?? null,
      context:   `${r.phone} · tipo: ${r.type}`,
      shop:      r.barbershop.name,
      timestamp: r.updatedAt.toISOString(),
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <ObservabilityClient
      errors={errors}
      summary={{
        cron24h:     cronErrorsTotal,
        sync24h:     syncErrorsTotal,
        whatsapp24h: waErrorsTotal,
        cron7d:      cronErrors.length,
        sync7d:      syncErrors.length,
        whatsapp7d:  waErrors.length,
      }}
    />
  );
}
