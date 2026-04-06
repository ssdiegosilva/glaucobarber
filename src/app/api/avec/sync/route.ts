import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncAvecBarbershop } from "@/lib/integrations/avec/sync";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await auth();
  if (!session?.user?.barbershopId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { barbershopId, id: userId } = session.user;

  try {
    let attempt = 0;
    let lastError: unknown = null;
    while (attempt < 3) {
      try {
        const result = await syncAvecBarbershop(barbershopId, userId);

        await prisma.auditLog.create({
          data: {
            barbershopId,
            userId,
            action:   "sync.triggered",
            entity:   "Integration",
            metadata: JSON.stringify({ ...result, provider: "avec", attempt: attempt + 1 }),
          },
        });

        await prisma.systemNotification.create({
          data: {
            barbershopId,
            type:  "SYSTEM",
            title: "Importação da Avec concluída",
            body:  `${result.customersUpserted} clientes, ${result.servicesUpserted} serviços e ${result.appointmentsUpserted} agendamentos importados com sucesso.`,
            link:  null,
          },
        });

        return NextResponse.json({ ...result, attempt: attempt + 1 });
      } catch (err) {
        lastError = err;
        attempt++;
        if (attempt >= 3) break;
      }
    }
    throw lastError ?? new Error("Sync failed");
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
