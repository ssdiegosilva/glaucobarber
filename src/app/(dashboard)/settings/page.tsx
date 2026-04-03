import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { BarbershopCard } from "./barbershop-card";
import { IntegrationsCard } from "./integrations-card";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.barbershopId) redirect("/onboarding");

  const barbershopId = session.user.barbershopId;

  const [barbershop, integration] = await Promise.all([
    prisma.barbershop.findUnique({ where: { id: barbershopId } }),
    prisma.integration.findUnique({ where: { barbershopId } }),
  ]);

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

        {/* Integrations */}
        <IntegrationsCard
          trinks={{
            connected: !!integration?.configJson && barbershop?.trinksConfigured === true,
          }}
          instagram={{
            connected: !!integration?.instagramPageAccessToken,
            username:  integration?.instagramUsername ?? null,
          }}
          whatsapp={{
            connected:     !!integration?.whatsappAccessToken,
            phoneNumberId: integration?.whatsappPhoneNumberId ?? null,
          }}
        />
      </div>
    </div>
  );
}
