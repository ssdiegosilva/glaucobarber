import { requireBarbershop } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { IntegrationsClient } from "./integrations-client";

export default async function IntegrationsPage() {
  const session = await requireBarbershop();

  const [integration, syncRuns] = await Promise.all([
    prisma.integration.findUnique({
      where:  { barbershopId: session.user.barbershopId },
      select: { status: true, lastSyncAt: true, errorMsg: true, configJson: true, instagramBusinessId: true, instagramUsername: true, whatsappAccessToken: true, whatsappPhoneNumberId: true, whatsappVerifyToken: true },
    }),
    prisma.syncRun.findMany({
      where:   { barbershopId: session.user.barbershopId },
      orderBy: { startedAt: "desc" },
      take:    10,
      select: {
        id: true, status: true, triggeredBy: true,
        customersUpserted: true, servicesUpserted: true, appointmentsUpserted: true,
        errorsCount: true, durationMs: true, startedAt: true,
      },
    }),
  ]);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Integrações"
        subtitle="Configuração e sincronização com a Trinks"
        userName={session.user.name}
      />
      <IntegrationsClient
        integration={integration ? {
          status:    integration.status,
          lastSyncAt: integration.lastSyncAt?.toISOString() ?? null,
          errorMsg:  integration.errorMsg,
          configured: !!integration.configJson,
          instagramBusinessId: integration.instagramBusinessId,
          instagramUsername:   integration.instagramUsername,
          whatsappConfigured: !!(integration.whatsappAccessToken && integration.whatsappPhoneNumberId),
          whatsappVerifyToken: integration.whatsappVerifyToken,
        } : null}
        barbershopId={session.user.barbershopId}
        syncRuns={syncRuns.map((r) => ({
          ...r,
          startedAt: r.startedAt.toISOString(),
        }))}
      />
    </div>
  );
}
