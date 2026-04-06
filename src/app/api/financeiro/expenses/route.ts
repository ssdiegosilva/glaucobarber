import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") ?? "0");
  const year  = parseInt(searchParams.get("year")  ?? "0");
  if (!month || !year) return NextResponse.json({ error: "month and year required" }, { status: 400 });

  const expenses = await prisma.expense.findMany({
    where:   { barbershopId: session.user.barbershopId, month, year },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(expenses);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { label, amountCents, month, year, note } = body;

  if (!label || typeof amountCents !== "number" || !month || !year) {
    return NextResponse.json({ error: "label, amountCents, month, year required" }, { status: 400 });
  }

  const expense = await prisma.expense.create({
    data: {
      barbershopId: session.user.barbershopId,
      label:        String(label).trim(),
      amountCents:  Math.round(amountCents),
      month:        Number(month),
      year:         Number(year),
      note:         note ? String(note).trim() : null,
    },
  });

  return NextResponse.json(expense, { status: 201 });
}
