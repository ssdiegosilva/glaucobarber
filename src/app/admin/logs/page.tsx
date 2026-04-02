import { prisma } from "@/lib/prisma";
import { LogsClient } from "./logs-client";

export default async function AdminLogsPage() {
  const [logs, total, shops] = await Promise.all([
    prisma.auditLog.findMany({
      include: {
        barbershop: { select: { name: true } },
        user:       { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.auditLog.count(),
    prisma.barbershop.findMany({
      where: { slug: { not: "__platform_admin__" } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <LogsClient
      logs={logs.map((l) => ({
        id:            l.id,
        action:        l.action,
        entity:        l.entity ?? "",
        metadata:      l.metadata ?? "",
        createdAt:     l.createdAt.toISOString(),
        barbershopName: l.barbershop?.name ?? null,
        userName:      l.user?.name ?? l.user?.email ?? null,
      }))}
      total={total}
      shops={shops}
    />
  );
}
