import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildTrinksClient } from "@/lib/integrations/trinks/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { price, name, description, durationMin, active } = body;

  const service = await prisma.service.findFirst({
    where: { id, barbershopId: session.user.barbershopId },
  });
  if (!service) return NextResponse.json({ error: "Serviço não encontrado" }, { status: 404 });

  const updated = await prisma.service.update({
    where: { id },
    data: {
      ...(price        != null ? { price: Number(price) }               : {}),
      ...(name         != null ? { name }                               : {}),
      ...(description  != null ? { description }                        : {}),
      ...(durationMin  != null ? { durationMin: Number(durationMin) }   : {}),
      ...(active       != null ? { active: Boolean(active) }            : {}),
    },
  });

  // Best-effort sync to Trinks if price changed
  if (price != null && service.trinksId) {
    try {
      const integration = await prisma.integration.findUnique({
        where: { barbershopId: session.user.barbershopId },
      });
      if (integration?.configJson) {
        // Trinks API does not expose a price-update endpoint in the current client
        // so we skip — just update locally for now
        void buildTrinksClient(integration.configJson); // ensure credentials are valid
      }
    } catch {
      // best-effort — no-op
    }
  }

  return NextResponse.json({ service: { ...updated, price: Number(updated.price) } });
}
