import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { VisitasClient } from "./visitas-client";

export default async function VisitasPage() {
  const session = await auth();
  if (!session?.user?.barbershopId) redirect("/login");

  const barbershopId = session.user.barbershopId;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const [visits, barbershop] = await Promise.all([
    prisma.visit.findMany({
      where: { barbershopId, visitedAt: { gte: startOfDay, lte: endOfDay } },
      include: { customer: { select: { id: true, name: true, phone: true } } },
      orderBy: { visitedAt: "desc" },
      take: 200,
    }),
    prisma.barbershop.findUnique({
      where: { id: barbershopId },
      select: { name: true, segment: { select: { tenantLabel: true, displayName: true } } },
    }),
  ]);

  const totalAmount = visits.reduce((acc, v) => acc + Number(v.amount ?? 0), 0);
  const tenantLabel = barbershop?.segment?.tenantLabel ?? "estabelecimento";

  const serialized = visits.map((v) => ({
    id:         v.id,
    visitedAt:  v.visitedAt.toISOString(),
    amount:     v.amount ? Number(v.amount) : null,
    notes:      v.notes,
    source:     v.source,
    customer:   v.customer ?? null,
  }));

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Visitas"
        subtitle={`${visits.length} visita${visits.length !== 1 ? "s" : ""} hoje`}
        userName={session.user.name ?? ""}
      />
      <VisitasClient
        initialVisits={serialized}
        totalAmount={totalAmount}
        tenantLabel={tenantLabel}
      />
    </div>
  );
}
