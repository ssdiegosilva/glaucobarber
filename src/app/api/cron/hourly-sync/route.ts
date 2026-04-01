import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncBarbershop } from "@/lib/integrations/trinks/sync";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const barbershops = await prisma.barbershop.findMany({
    where: { integration: { status: "ACTIVE" } },
    select: { id: true },
  });

  const results: Array<{ barbershopId: string; ok: boolean; error?: string }> = [];

  for (const shop of barbershops) {
    try {
      await syncBarbershop(shop.id, "cron:hourly");
      results.push({ barbershopId: shop.id, ok: true });
    } catch (err) {
      results.push({ barbershopId: shop.id, ok: false, error: String(err) });
    }
  }

  return NextResponse.json({ ranAt: new Date().toISOString(), results });
}
