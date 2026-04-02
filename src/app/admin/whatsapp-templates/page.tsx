import { prisma } from "@/lib/prisma";
import { WaTemplatesClient } from "./wa-templates-client";

export const dynamic = "force-dynamic";

export default async function AdminWaTemplatesPage() {
  const barbershops = await prisma.barbershop.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    where: { name: { not: "__platform_admin__" } },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">WhatsApp Templates</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Templates aprovados pela Meta para cada barbearia. O nome Meta deve ser exatamente igual ao cadastrado no Business Manager.
        </p>
      </div>
      <WaTemplatesClient barbershops={barbershops} />
    </div>
  );
}
