import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMonthlyFinanceiroData } from "@/lib/financeiro/monthly-data";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const month  = parseInt(params.get("month") ?? "");
  const year   = parseInt(params.get("year")  ?? "");

  if (!month || !year || month < 1 || month > 12) {
    return NextResponse.json({ error: "month e year obrigatórios" }, { status: 400 });
  }

  const data = await getMonthlyFinanceiroData(session.user.barbershopId, month, year);
  return NextResponse.json(data);
}
