import { requireBarbershop } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { OffersClient } from "./offers-client";

export default async function OffersPage() {
  const session = await requireBarbershop();

  const barbershopId = session.user.barbershopId;

  const [offers, services] = await Promise.all([
    prisma.offer.findMany({
      where:   { barbershopId },
      include: {
        items: {
          include: { service: { select: { id: true, name: true, category: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.service.findMany({
      where:   { barbershopId, active: true },
      select:  { id: true, name: true, category: true, price: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
  ]);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Ofertas & Pacotes"
        subtitle="Crie combos e promoções vinculando seus serviços"
        userName={session.user.name}
      />
      <div className="p-6">
        <OffersClient
          initialOffers={offers.map((o) => ({
            id:               o.id,
            type:             o.type,
            status:           o.status,
            title:            o.title,
            description:      o.description,
            originalPrice:    Number(o.originalPrice),
            salePrice:        Number(o.salePrice),
            credits:          o.credits,
            validUntil:       o.validUntil?.toISOString() ?? null,
            maxRedemptions:   o.maxRedemptions,
            redemptionsCount: o.redemptionsCount,
            items: o.items.map((i) => ({
              id:          i.id,
              serviceId:   i.serviceId,
              serviceName: i.service?.name ?? "—",
              category:    i.service?.category ?? "OTHER",
              quantity:    i.quantity,
              unitPrice:   Number(i.unitPrice),
              discountPct: i.discountPct,
            })),
          }))}
          availableServices={services.map((s) => ({
            id:       s.id,
            name:     s.name,
            category: s.category,
            price:    Number(s.price),
          }))}
        />
      </div>
    </div>
  );
}
