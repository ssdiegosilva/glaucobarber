import { requireBarbershop } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { ServicesClient } from "./services-client";

export default async function ServicesPage() {
  const session = await requireBarbershop();

  const barbershopId = session.user.barbershopId;

  const [services, integration, opportunities, barbershop] = await Promise.all([
    prisma.service.findMany({
      where:   { barbershopId, deletedAt: null },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    prisma.integration.findUnique({
      where:  { barbershopId },
      select: { status: true },
    }),
    prisma.serviceOpportunity.findMany({
      where:   { barbershopId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.barbershop.findUnique({
      where:  { id: barbershopId },
      select: { address: true, city: true, state: true, segment: { select: { tenantLabel: true } } },
    }),
  ]);

  const hasTrinks = integration?.status === "ACTIVE";

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Serviços"
        subtitle={`${services.length} serviços${hasTrinks ? " · sincronizados da Trinks" : ""}`}
        userName={session.user.name}
      />
      <div className="p-6">
        <ServicesClient
          tenantLabel={barbershop?.segment?.tenantLabel ?? "estabelecimento"}
          initialServices={services.map((s) => ({
            id:               s.id,
            name:             s.name,
            description:      s.description,
            category:         s.category,
            price:            Number(s.price),
            durationMin:      s.durationMin,
            active:           s.active,
            syncedFromTrinks: s.syncedFromTrinks,
          }))}
          initialOpportunities={opportunities.map((o) => ({
            id:             o.id,
            name:           o.name,
            category:       o.category,
            description:    o.description,
            suggestedPrice: Number(o.suggestedPrice),
            rationale:      o.rationale,
          }))}
          hasTrinks={hasTrinks}
          barbershopLocation={{
            address: barbershop?.address ?? null,
            city:    barbershop?.city ?? null,
            state:   barbershop?.state ?? null,
          }}
        />
      </div>
    </div>
  );
}
