import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { OfertaWizard } from "./oferta-wizard";

export default async function NovaOfertaPage() {
  const session = await auth();
  if (!session?.user?.barbershopId) redirect("/login");

  const shop = await prisma.barbershop.findUnique({
    where: { id: session.user.barbershopId },
    select: { slug: true },
  });

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Nova Oferta Direcionada"
        subtitle="Configure e envie uma oferta para clientes inativos"
        userName={session.user.name ?? ""}
      />
      <OfertaWizard shopSlug={shop?.slug ?? null} />
    </div>
  );
}
