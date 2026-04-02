import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { ServicesClient } from "./services-client";

export default async function ServicesPage() {
  const session = await auth();
  if (!session?.user?.barbershopId) redirect("/onboarding");

  const [services, integration] = await Promise.all([
    prisma.service.findMany({
      where:   { barbershopId: session.user.barbershopId },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    prisma.integration.findUnique({
      where:  { barbershopId: session.user.barbershopId },
      select: { status: true },
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
          initialServices={services.map((s) => ({
            id:              s.id,
            name:            s.name,
            description:     s.description,
            category:        s.category,
            price:           Number(s.price),
            durationMin:     s.durationMin,
            active:          s.active,
            syncedFromTrinks: s.syncedFromTrinks,
          }))}
          hasTrinks={hasTrinks}
        />
      </div>
    </div>
  );
}
