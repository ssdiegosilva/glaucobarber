import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface ContactInput {
  name: string;
  phone?: string | null;
  email?: string | null;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contacts } = await req.json() as { contacts: ContactInput[] };
  if (!Array.isArray(contacts) || contacts.length === 0) {
    return NextResponse.json({ error: "Nenhum contato enviado" }, { status: 400 });
  }

  const barbershopId = session.user.barbershopId;

  // Get existing phones/emails to skip duplicates
  const phones = contacts.map((c) => c.phone?.trim()).filter(Boolean) as string[];
  const existing = phones.length > 0
    ? await prisma.customer.findMany({
        where: { barbershopId, deletedAt: null, phone: { in: phones } },
        select: { phone: true },
      })
    : [];
  const existingPhones = new Set(existing.map((e) => e.phone));

  const toCreate = contacts
    .filter((c) => c.name?.trim())
    .filter((c) => !c.phone?.trim() || !existingPhones.has(c.phone.trim()))
    .map((c) => ({
      barbershopId,
      name:             c.name.trim(),
      phone:            c.phone?.trim() || null,
      email:            c.email?.trim() || null,
      syncedFromTrinks: false,
    }));

  if (toCreate.length === 0) {
    return NextResponse.json({ imported: 0, skipped: contacts.length });
  }

  const result = await prisma.customer.createMany({ data: toCreate, skipDuplicates: true });

  return NextResponse.json({
    imported: result.count,
    skipped:  contacts.length - result.count,
  });
}
