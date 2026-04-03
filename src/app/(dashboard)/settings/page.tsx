import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { Building2, Palette, Plug, CheckCircle2, AlertCircle } from "lucide-react";
import { BarbershopCard } from "./barbershop-card";
import { GoogleReviewCard } from "./google-review-card";
import { BrandStyleCard } from "./brand-style-card";
import { CampaignReferenceImageCard } from "./campaign-reference-image-card";
import { IntegrationsClient } from "./integrations-client";
import { CollapsibleSection } from "./collapsible-section";

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

  const integrationConnected = !!integration?.configJson;
  const identityConfigured   = !!(barbershop?.brandStyle?.trim() || barbershop?.campaignReferenceImageUrl?.trim());

  return (
    <div className="flex flex-col h-full">
      <Header title="Configurações" userName={session.user.name} />

      <div className="p-4 sm:p-6 space-y-3 max-w-3xl">

        {/* ── Dados da barbearia ─────────────────────────────── */}
        <CollapsibleSection
          icon={<Building2 className="h-4 w-4" />}
          title="Dados da barbearia"
          description="Nome, contato, logo e redes sociais"
          badge={
            barbershop ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Configurado
              </span>
            ) : undefined
          }
        >
          {barbershop && (
            <div className="space-y-3">
              <BarbershopCard
                barbershop={{
                  id:              barbershop.id,
                  name:            barbershop.name,
                  email:           barbershop.email,
                  phone:           barbershop.phone,
                  city:            barbershop.city,
                  state:           barbershop.state,
                  address:         barbershop.address,
                  websiteUrl:      barbershop.websiteUrl,
                  description:     barbershop.description,
                  slug:            barbershop.slug,
                  logoUrl:         barbershop.logoUrl,
                  instagramUrl:    barbershop.instagramUrl,
                  googleReviewUrl: barbershop.googleReviewUrl ?? null,
                }}
              />
              <GoogleReviewCard initialUrl={barbershop.googleReviewUrl ?? null} />
            </div>
          )}
        </CollapsibleSection>

        {/* ── Identidade visual ──────────────────────────────── */}
        <CollapsibleSection
          icon={<Palette className="h-4 w-4" />}
          title="Identidade visual"
          description="Estilo de marca e imagem de referência para campanhas"
          badge={
            identityConfigured ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Configurado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-400">
                <AlertCircle className="h-3 w-3" /> Não configurado
              </span>
            )
          }
        >
          <div className="space-y-4">
            <BrandStyleCard
              initialStyle={barbershop?.brandStyle ?? null}
              barbershopName={barbershop?.name ?? null}
              logoUrl={barbershop?.logoUrl ?? null}
            />
            <CampaignReferenceImageCard initialUrl={barbershop?.campaignReferenceImageUrl ?? null} />
          </div>
        </CollapsibleSection>

        {/* ── Integrações ────────────────────────────────────── */}
        <CollapsibleSection
          icon={<Plug className="h-4 w-4" />}
          title="Integrações"
          description="Trinks, Instagram e WhatsApp"
          badge={
            integrationConnected ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Conectado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <AlertCircle className="h-3 w-3" /> Não conectado
              </span>
            )
          }
        >
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
        </CollapsibleSection>

      </div>
    </div>
  );
}
