import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { BarbershopCard } from "./barbershop-card";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.barbershopId) redirect("/onboarding");

  const barbershop = await prisma.barbershop.findUnique({
    where: { id: session.user.barbershopId },
  });

  return (
    <div className="flex flex-col h-full">
      <Header title="Configurações" userName={session.user.name} />

      <div className="p-6 space-y-6 max-w-3xl">
        {/* Barbershop info */}
        {barbershop && (
          <BarbershopCard
            barbershop={{
              id: barbershop.id,
              name: barbershop.name,
              email: barbershop.email,
              phone: barbershop.phone,
              city: barbershop.city,
              state: barbershop.state,
              address: barbershop.address,
              websiteUrl: barbershop.websiteUrl,
              description: barbershop.description,
              slug: barbershop.slug,
              logoUrl: barbershop.logoUrl,
              instagramUrl: barbershop.instagramUrl,
            }}
          />
        )}

      </div>
    </div>
  );
}
