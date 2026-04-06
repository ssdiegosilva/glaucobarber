import { prisma } from "@/lib/prisma";
import { ObservabilityClient } from "./observability-client";

export default async function AdminObservabilityPage() {
  const ago30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const ago24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    cronErrors,
    syncErrors,
    waErrors,
    campaignErrors,
    cronErrors24h,
    syncErrors24h,
    waErrors24h,
    campaignErrors24h,
  ] = await Promise.all([
    // CronRun failures last 30 days
    prisma.cronRun.findMany({
      where:   { status: "failed", ranAt: { gte: ago30d } },
      orderBy: { ranAt: "desc" },
      take:    500,
    }),

    // SyncRun failures last 30 days
    prisma.syncRun.findMany({
      where:   { status: { in: ["FAILED", "PARTIAL"] }, startedAt: { gte: ago30d } },
      include: { barbershop: { select: { name: true } } },
      orderBy: { startedAt: "desc" },
      take:    500,
    }),

    // WhatsApp failures last 30 days
    prisma.whatsappMessage.findMany({
      where:   { status: "FAILED", updatedAt: { gte: ago30d } },
      include: { barbershop: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take:    500,
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

    // Campaign failures last 30 days
    prisma.campaign.findMany({
      where:   { status: "FAILED", updatedAt: { gte: ago30d } },
      include: { barbershop: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take:    500,
    }),

    // 24h counts for summary cards
    prisma.cronRun.count({ where: { status: "failed",             ranAt:     { gte: ago24h } } }),
    prisma.syncRun.count({ where: { status: { in: ["FAILED", "PARTIAL"] }, startedAt: { gte: ago24h } } }),
    prisma.whatsappMessage.count({ where: { status: "FAILED",     updatedAt: { gte: ago24h } } }),
    prisma.campaign.count({ where: { status: "FAILED",            updatedAt: { gte: ago24h } } }),
  ]);

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

    ...campaignErrors.map((r) => ({
      id:        r.id,
      source:    "campaign" as const,
      title:     `Campanha falhou: ${r.title}`,
      detail:    r.errorMsg ?? null,
      context:   r.channel ? `canal: ${r.channel}` : null,
      shop:      r.barbershop.name,
      timestamp: r.updatedAt.toISOString(),
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <ObservabilityClient
      errors={errors}
      summary={{
        cron24h:      cronErrors24h,
        sync24h:      syncErrors24h,
        whatsapp24h:  waErrors24h,
        campaign24h:  campaignErrors24h,
        cron30d:      cronErrors.length,
        sync30d:      syncErrors.length,
        whatsapp30d:  waErrors.length,
        campaign30d:  campaignErrors.length,
      }}
    />
  );
}
