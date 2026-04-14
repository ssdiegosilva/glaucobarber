import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { OfertaWizard } from "./oferta-wizard";

export default async function NovaOfertaPage() {
  const session = await auth();
  if (!session?.user?.barbershopId) redirect("/login");

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Nova Oferta Direcionada"
        subtitle="Configure e envie uma oferta para clientes inativos"
        userName={session.user.name ?? ""}
      />
      <OfertaWizard />
    </div>
  );
}
