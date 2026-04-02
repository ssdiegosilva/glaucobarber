import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.barbershopId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id }   = await params;
  const { status } = await req.json();

  const offer = await prisma.offer.findFirst({
    where: { id, barbershopId: session.user.barbershopId },
  });
  if (!offer) return NextResponse.json({ error: "Oferta não encontrada" }, { status: 404 });

  const updated = await prisma.offer.update({
    where: { id },
    data:  { status },
  });

  return NextResponse.json({ offer: { ...updated, originalPrice: Number(updated.originalPrice), salePrice: Number(updated.salePrice) } });
}
