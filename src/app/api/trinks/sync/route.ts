import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncBarbershop } from "@/lib/integrations/trinks/sync";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await auth();

  if (!session?.user?.barbershopId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let attempt = 0;
    let lastError: unknown = null;
    while (attempt < 3) {
      try {
        const result = await syncBarbershop(session.user.barbershopId, session.user.id);

        await prisma.auditLog.create({
          data: {
            barbershopId: session.user.barbershopId,
            userId:       session.user.id,
            action:       "sync.triggered",
            entity:       "Integration",
            metadata:     JSON.stringify({ ...result, attempt: attempt + 1 }),
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
