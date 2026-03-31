// ============================================================
// Trinks Sync Engine
//
// Pulls data from Trinks and upserts into local DB.
// Can be triggered manually (UI) or via cron.
// ============================================================

import { prisma } from "@/lib/prisma";
import { buildTrinksClient } from "./client";
import { mapTrinksCustomer, mapTrinksService, mapTrinksAppointment } from "./mappers";
import type { SyncResult, SyncError } from "./types";
import { subDays, format } from "date-fns";

export async function syncBarbershop(
  barbershopId: string,
  triggeredBy:  string = "manual"
): Promise<SyncResult> {
  const startedAt = Date.now();
  const errors:  SyncError[] = [];
  let customersUpserted    = 0;
  let servicesUpserted     = 0;
  let appointmentsUpserted = 0;

  // Load integration config
  const integration = await prisma.integration.findUnique({
    where: { barbershopId },
  });

  if (!integration || !integration.configJson) {
    throw new Error("Trinks integration not configured for this barbershop");
  }

  // Create sync run record
  const syncRun = await prisma.syncRun.create({
    data: {
      barbershopId,
      integrationId: integration.id,
      status: "RUNNING",
      triggeredBy,
    },
  });

  try {
    const client = buildTrinksClient(integration.configJson);

    // ── 1. Sync Customers ──────────────────────────────────
    try {
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const res = await client.getCustomers(page, 100);

        for (const raw of res.data) {
          try {
            const data = mapTrinksCustomer(raw, barbershopId);
            await prisma.customer.upsert({
              where: { barbershopId_trinksId: { barbershopId, trinksId: raw.id } },
              create: data,
              update: {
                ...data,
                // Preserve local-only fields
                status:      undefined,
                totalVisits: undefined,
                totalSpent:  undefined,
              },
            });
            customersUpserted++;
          } catch (err) {
            errors.push({ entity: "Customer", entityId: raw.id, message: String(err) });
          }
        }

        hasMore = page < res.totalPages;
        page++;
      }
    } catch (err) {
      errors.push({ entity: "Customers (bulk)", message: String(err) });
    }

    // ── 2. Sync Services ───────────────────────────────────
    try {
      const res = await client.getServices();

      for (const raw of res.data) {
        try {
          const data = mapTrinksService(raw, barbershopId);
          await prisma.service.upsert({
            where: { barbershopId_trinksId: { barbershopId, trinksId: raw.id } },
            create: data,
            update: data,
          });
          servicesUpserted++;
        } catch (err) {
          errors.push({ entity: "Service", entityId: raw.id, message: String(err) });
        }
      }
    } catch (err) {
      errors.push({ entity: "Services (bulk)", message: String(err) });
    }

    // ── 3. Sync Appointments (last 30 days + next 14 days) ─
    try {
      const dateFrom = format(subDays(new Date(), 30), "yyyy-MM-dd");
      const dateTo   = format(new Date(Date.now() + 14 * 86400_000), "yyyy-MM-dd");

      // Build lookup maps
      const customers = await prisma.customer.findMany({
        where: { barbershopId, trinksId: { not: null } },
        select: { id: true, trinksId: true },
      });
      const services = await prisma.service.findMany({
        where: { barbershopId, trinksId: { not: null } },
        select: { id: true, trinksId: true },
      });

      const customerMap = new Map(customers.map((c) => [c.trinksId!, c.id]));
      const serviceMap  = new Map(services.map((s) => [s.trinksId!,  s.id]));

      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const res = await client.getAppointments({ dateFrom, dateTo, page, perPage: 100 });

        for (const raw of res.data) {
          try {
            const data = mapTrinksAppointment(raw, barbershopId, customerMap, serviceMap);
            await prisma.appointment.upsert({
              where: { barbershopId_trinksId: { barbershopId, trinksId: raw.id } },
              create: data,
              update: { ...data, syncedFromTrinks: true, lastSyncedAt: new Date() },
            });
            appointmentsUpserted++;
          } catch (err) {
            errors.push({ entity: "Appointment", entityId: raw.id, message: String(err) });
          }
        }

        hasMore = page < res.totalPages;
        page++;
      }
    } catch (err) {
      errors.push({ entity: "Appointments (bulk)", message: String(err) });
    }

    const durationMs = Date.now() - startedAt;
    const status = errors.length === 0 ? "SUCCESS" : "PARTIAL";

    // Update sync run
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status,
        customersUpserted,
        servicesUpserted,
        appointmentsUpserted,
        errorsCount:   errors.length,
        errorDetails:  errors.length ? JSON.stringify(errors) : null,
        durationMs,
        finishedAt:    new Date(),
      },
    });

    // Update integration last sync
    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        lastSyncAt: new Date(),
        status:     "ACTIVE",
        errorMsg:   null,
      },
    });

    return { customersUpserted, servicesUpserted, appointmentsUpserted, errors, durationMs };

  } catch (globalErr) {
    const durationMs = Date.now() - startedAt;

    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status:      "FAILED",
        errorsCount: 1,
        errorDetails: JSON.stringify([{ entity: "Global", message: String(globalErr) }]),
        durationMs,
        finishedAt:  new Date(),
      },
    });

    await prisma.integration.update({
      where: { id: integration.id },
      data: { status: "ERROR", errorMsg: String(globalErr) },
    });

    throw globalErr;
  }
}
