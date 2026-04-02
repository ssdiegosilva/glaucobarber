import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/whatsapp/templates — list active templates for the barbershop
export async function GET() {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const templates = await prisma.whatsappTemplate.findMany({
    where:   { barbershopId: session.user.barbershopId, active: true },
    orderBy: { label: "asc" },
  });

  return NextResponse.json(templates);
}
