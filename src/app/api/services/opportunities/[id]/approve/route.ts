import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.barbershopId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const barbershopId = session.user.barbershopId;
  const { id } = await params;

  const opportunity = await prisma.serviceOpportunity.findFirst({
    where: { id, barbershopId, status: "PENDING" },
  });
  if (!opportunity) {
    return NextResponse.json({ error: "Oportunidade não encontrada" }, { status: 404 });
  }

  // Create the service
  const service = await prisma.service.create({
    data: {
      barbershopId,
      name:        opportunity.name,
      description: opportunity.description,
      category:    opportunity.category,
      price:       opportunity.suggestedPrice,
      durationMin: 30,
      active:      true,
    },
  });

  // Mark opportunity as approved
  await prisma.serviceOpportunity.update({
    where: { id },
    data: { status: "APPROVED", approvedServiceId: service.id },
  });

  return NextResponse.json({
    service: { ...service, price: Number(service.price) },
  });
}
