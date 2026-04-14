import { Suspense } from "react";
import { requireBarbershop } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { Building2, Palette, Plug, Users, CreditCard, CheckCircle2, AlertCircle, ShieldCheck, Layers } from "lucide-react";
import { BarbershopCard } from "./barbershop-card";
import { GoogleReviewCard } from "./google-review-card";
import { BrandStyleCard } from "./brand-style-card";
import { CampaignReferenceImageCard } from "./campaign-reference-image-card";
import { IntegrationsClient } from "./integrations-client";
import { CollapsibleSection } from "./collapsible-section";
import { TeamCard } from "./team-card";
import { CardFeesCard } from "./card-fees-card";
import { ChangePasswordCard } from "./change-password-card";
import { SegmentCard } from "./segment-card";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const session = await requireBarbershop();

  const { section } = await searchParams;

  const barbershopId = session.user.barbershopId;

  const [barbershop, integration, syncRuns, members, cardFeeConfigs] = await Promise.all([
    prisma.barbershop.findUnique({ where: { id: barbershopId }, select: { id: true, slug: true, name: true, email: true, phone: true, city: true, state: true, address: true, websiteUrl: true, description: true, logoUrl: true, instagramUrl: true, googleReviewUrl: true, brandStyle: true, campaignReferenceImageUrl: true, segmentId: true, segment: { select: { tenantLabel: true } } } }),
    prisma.integration.findUnique({
      where:  { barbershopId },
      select: { provider: true, status: true, lastSyncAt: true, errorMsg: true, configJson: true, instagramBusinessId: true, instagramUsername: true, instagramPageAccessToken: true, whatsappAccessToken: true, whatsappPhoneNumberId: true, whatsappVerifyToken: true, whatsappWabaId: true },
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
    prisma.membership.findMany({
      where:   { barbershopId },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.cardFeeConfig.findMany({
      where: { barbershopId },
      orderBy: [{ brand: "asc" }, { paymentType: "asc" }],
      select: { brand: true, paymentType: true, feePercent: true },
    }),
  ]);

  const callerMembership = members.find((m) => m.userId === session.user.id);
  const isOwner = callerMembership?.role === "OWNER";
  const tenantLabel = barbershop?.segment?.tenantLabel ?? "barbearia";

  const serializedMembers = members.map((m) => ({
    id:        m.id,
    userId:    m.user.id,
    name:      m.user.name,
    email:     m.user.email,
    role:      m.role,
    active:    m.active,
    trinksId:  m.trinksId,
    createdAt: m.createdAt.toISOString(),
  }));

  const integrationConnected = !!integration?.configJson;
  const identityConfigured   = !!(barbershop?.brandStyle?.trim() || barbershop?.campaignReferenceImageUrl?.trim());

  // Per-integration status: null = not started, "partial" = partially configured, "complete" = fully configured
  const opProvider = integration?.provider ?? "trinks"; // "trinks" | "avec"
  const opLabel    = opProvider === "avec" ? "Avec" : "Trinks";
  const opStatus: "complete" | "partial" | null = integration?.status === "ACTIVE"
    ? "complete"
    : integration?.configJson ? "partial" : null;
  // Keep trinksStatus as alias for backwards compat with badge array below
  const trinksStatus = opStatus;
  const whatsappStatus: "complete" | "partial" | null =
    integration?.whatsappAccessToken && integration?.whatsappPhoneNumberId
      ? integration?.whatsappWabaId ? "complete" : "partial"
      : null;
  const instagramStatus: "complete" | "partial" | null =
    integration?.instagramBusinessId
      ? "complete"
      : integration?.instagramPageAccessToken ? "partial" : null;

  const barbershopComplete = !!(
    barbershop?.name?.trim() &&
    barbershop?.phone?.trim() &&
    barbershop?.address?.trim() &&
    barbershop?.googleReviewUrl?.trim()
  );
  const barbershopPartial = !!barbershop && !barbershopComplete;

  return (
    <div className="flex flex-col h-full">
      <Header title="Configurações" userName={session.user.name} />

      <div className="p-4 sm:p-6 space-y-3 max-w-3xl">

        {/* ── Dados da barbearia ─────────────────────────────── */}
        <CollapsibleSection
          icon={<Building2 className="h-4 w-4" />}
          title={`Dados do ${tenantLabel}`}
          description="Nome, contato, logo e redes sociais"
          badge={
            barbershopComplete ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Configurado
              </span>
            ) : barbershopPartial ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-400">
                <AlertCircle className="h-3 w-3" /> Parcial
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
          id="identity"
          icon={<Palette className="h-4 w-4" />}
          title="Identidade visual"
          description="Estilo de marca e imagem de referência para campanhas"
          defaultOpen={section === "identity"}
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

        {/* ── Equipe ─────────────────────────────────────────── */}
        <CollapsibleSection
          id="team"
          icon={<Users className="h-4 w-4" />}
          title="Equipe"
          description={`Membros do ${tenantLabel}`}
          defaultOpen={section === "team"}
          badge={
            <span className="text-[10px] text-muted-foreground">
              {members.length} {members.length === 1 ? "membro" : "membros"}
            </span>
          }
        >
          <TeamCard initialMembers={serializedMembers} isOwner={isOwner} />
        </CollapsibleSection>

        {/* ── Taxas de maquininha ─────────────────────────────── */}
        <CollapsibleSection
          id="card-fees"
          icon={<CreditCard className="h-4 w-4" />}
          title="Taxas de maquininha"
          description="Configure as taxas por bandeira e tipo de pagamento"
          defaultOpen={section === "card-fees"}
          badge={
            cardFeeConfigs.length > 0 ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Configurado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-400">
                <AlertCircle className="h-3 w-3" /> Nao configurado
              </span>
            )
          }
        >
          <CardFeesCard
            initialConfigs={cardFeeConfigs.map((c) => ({
              brand: c.brand,
              paymentType: c.paymentType,
              feePercent: Number(c.feePercent),
            }))}
          />
        </CollapsibleSection>

        {/* ── Tipo de estabelecimento ────────────────────────── */}
        <CollapsibleSection
          id="segment"
          icon={<Layers className="h-4 w-4" />}
          title="Tipo de estabelecimento"
          description="Define o tema visual, módulos e prompts de IA da plataforma"
          defaultOpen={section === "segment"}
        >
          <SegmentCard currentSegmentId={barbershop?.segmentId ?? null} />
        </CollapsibleSection>

        {/* ── Segurança ──────────────────────────────────────── */}
        <CollapsibleSection
          id="security"
          icon={<ShieldCheck className="h-4 w-4" />}
          title="Segurança"
          description="Alterar senha da sua conta"
          defaultOpen={section === "security"}
        >
          <ChangePasswordCard />
        </CollapsibleSection>

        {/* ── Integrações ────────────────────────────────────── */}
        <CollapsibleSection
          id="integrations"
          icon={<Plug className="h-4 w-4" />}
          title="Integrações"
          description={`${opLabel}, Instagram e WhatsApp`}
          defaultOpen={section === "integrations"}
          badge={
            <span className="hidden sm:inline-flex items-center gap-1.5">
              {[
                { label: opLabel,     status: trinksStatus    },
                { label: "WhatsApp",  status: whatsappStatus  },
                { label: "Instagram", status: instagramStatus },
              ].map(({ label, status }) => (
                <span
                  key={label}
                  className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border ${
                    status === "complete"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : status === "partial"
                      ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
                      : "border-zinc-700 bg-zinc-800/50 text-zinc-500"
                  }`}
                >
                  {status === "complete" ? (
                    <CheckCircle2 className="h-2.5 w-2.5" />
                  ) : status === "partial" ? (
                    <AlertCircle className="h-2.5 w-2.5" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-zinc-600" />
                  )}
                  {label}
                </span>
              ))}
            </span>
          }
        >
          <Suspense>
            <IntegrationsClient
              integration={integration ? {
                provider:            integration.provider,
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
