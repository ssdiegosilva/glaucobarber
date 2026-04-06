import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncBarbershop } from "@/lib/integrations/trinks/sync";
import { getKillSwitch } from "@/lib/platform-config";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();
  const run = await prisma.cronRun.create({
    data: { cronName: "hourly-sync", status: "running" },
  });

  try {
    if (await getKillSwitch("kill_trinks_sync")) {
      await prisma.cronRun.update({
        where: { id: run.id },
        data: { status: "success", durationMs: Date.now() - start, error: "kill_trinks_sync active — skipped" },
      });
      return NextResponse.json({ ranAt: new Date().toISOString(), skipped: true, reason: "kill_trinks_sync" });
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

    await prisma.cronRun.update({
      where: { id: run.id },
      data: { status: "success", durationMs: Date.now() - start },
    });

    return NextResponse.json({ ranAt: new Date().toISOString(), results });
  } catch (err) {
    await prisma.cronRun.update({
      where: { id: run.id },
      data: { status: "failed", durationMs: Date.now() - start, error: String(err) },
    });
    throw err;
  }
}
