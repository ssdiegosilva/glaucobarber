import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { BarbershopCard } from "./barbershop-card";
import { BrandStyleCard } from "./brand-style-card";
import { CampaignReferenceImageCard } from "./campaign-reference-image-card";
import { IntegrationsClient } from "./integrations-client";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.barbershopId) redirect("/onboarding");

  const barbershopId = session.user.barbershopId;

  const [barbershop, integration, syncRuns] = await Promise.all([
    prisma.barbershop.findUnique({ where: { id: barbershopId } }),
    prisma.integration.findUnique({
      where:  { barbershopId },
      select: { status: true, lastSyncAt: true, errorMsg: true, configJson: true, instagramBusinessId: true, instagramUsername: true, whatsappAccessToken: true, whatsappPhoneNumberId: true, whatsappVerifyToken: true, whatsappWabaId: true },
    }),
    prisma.syncRun.findMany({
      where:   { barbershopId },
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
      <Header title="Configurações" userName={session.user.name} />

      <div className="p-6 space-y-6 max-w-3xl">
        {barbershop && (
          <BarbershopCard
            barbershop={{
              id:          barbershop.id,
              name:        barbershop.name,
              email:       barbershop.email,
              phone:       barbershop.phone,
              city:        barbershop.city,
              state:       barbershop.state,
              address:     barbershop.address,
              websiteUrl:  barbershop.websiteUrl,
              description: barbershop.description,
              slug:        barbershop.slug,
              logoUrl:     barbershop.logoUrl,
              instagramUrl: barbershop.instagramUrl,
            }}
          />
        )}

        <BrandStyleCard
          initialStyle={barbershop?.brandStyle ?? null}
          barbershopName={barbershop?.name ?? null}
          logoUrl={barbershop?.logoUrl ?? null}
        />

        <CampaignReferenceImageCard initialUrl={barbershop?.campaignReferenceImageUrl ?? null} />

        <Suspense>
        <IntegrationsClient
          integration={integration ? {
            status:              integration.status,
            lastSyncAt:          integration.lastSyncAt?.toISOString() ?? null,
            errorMsg:            integration.errorMsg,
            configured:          !!integration.configJson,
            instagramBusinessId: integration.instagramBusinessId,
            instagramUsername:   integration.instagramUsername,
            whatsappConfigured:  !!(integration.whatsappAccessToken && integration.whatsappPhoneNumberId),
            whatsappVerifyToken: integration.whatsappVerifyToken,
            whatsappWabaId:      integration.whatsappWabaId,
          } : null}
          barbershopId={barbershopId}
          syncRuns={syncRuns.map((r) => ({
            ...r,
            startedAt: r.startedAt.toISOString(),
          }))}
        />
        </Suspense>
      </div>
    </div>
  );
}
