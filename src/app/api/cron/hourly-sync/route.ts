import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncBarbershop } from "@/lib/integrations/trinks/sync";
import { syncAvecBarbershop } from "@/lib/integrations/avec/sync";
import { getKillSwitch } from "@/lib/platform-config";
import { after } from "next/server";

export const maxDuration = 60;

const MAX_SYNCS_PER_RUN = 5;
const SYNC_TIMEOUT_MS = 50_000;

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (await getKillSwitch("kill_trinks_sync")) {
    return NextResponse.json({ ranAt: new Date().toISOString(), skipped: true, reason: "kill_trinks_sync" });
  }

  // Respond immediately — sync runs in background via after()
  after(async () => {
    const start = Date.now();
    const run = await prisma.cronRun.create({
      data: { cronName: "hourly-sync", status: "running" },
    });

    try {
      const barbershops = await prisma.barbershop.findMany({
        where: { integration: { status: "ACTIVE" } },
        select: { id: true, integration: { select: { provider: true, lastSyncAt: true } } },
        orderBy: { integration: { lastSyncAt: "asc" } },
        take: MAX_SYNCS_PER_RUN,
      });

      const results: Array<{ barbershopId: string; ok: boolean; error?: string }> = [];

      for (const shop of barbershops) {
        if (Date.now() - start > SYNC_TIMEOUT_MS) {
          results.push({ barbershopId: shop.id, ok: false, error: "timeout safety" });
          continue;
        }

        const provider = shop.integration?.provider ?? "trinks";
        try {
          if (provider === "avec") {
            await syncAvecBarbershop(shop.id, "cron:hourly");
          } else if (provider === "trinks") {
            await syncBarbershop(shop.id, "cron:hourly");
          }
          results.push({ barbershopId: shop.id, ok: true });
        } catch (err) {
          results.push({ barbershopId: shop.id, ok: false, error: String(err) });
        }
      }

      await prisma.cronRun.update({
        where: { id: run.id },
        data: {
          status: results.some((r) => !r.ok) ? "partial" : "success",
          durationMs: Date.now() - start,
          error: results.filter((r) => !r.ok).map((r) => `${r.barbershopId}: ${r.error}`).join("; ") || null,
        },
      });
    } catch (err) {
      await prisma.cronRun.update({
        where: { id: run.id },
        data: { status: "failed", durationMs: Date.now() - start, error: String(err) },
      });
    }
  });

  return NextResponse.json({ ranAt: new Date().toISOString(), accepted: true });
}
