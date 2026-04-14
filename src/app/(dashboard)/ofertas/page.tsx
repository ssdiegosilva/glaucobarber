import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { OfertasClient } from "./ofertas-client";

export default async function OfertasPage() {
  const session = await auth();
  if (!session?.user?.barbershopId) redirect("/login");

  const barbershopId = session.user.barbershopId;

  const offers = await prisma.targetedOffer.findMany({
    where: { barbershopId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Ofertas Direcionadas"
        subtitle={`${offers.length} oferta${offers.length !== 1 ? "s" : ""} criada${offers.length !== 1 ? "s" : ""}`}
        userName={session.user.name ?? ""}
      />
      <OfertasClient initialOffers={offers.map((o: typeof offers[number]) => ({
        id: o.id,
        title: o.title,
        type: o.type,
        referenceNames: o.referenceNames,
        daysInactive: o.daysInactive,
        discount: o.discount,
        discountPct: o.discountPct,
        customersCount: o.customersCount,
        status: o.status,
        createdAt: o.createdAt.toISOString(),
      }))} />
    </div>
  );
}
