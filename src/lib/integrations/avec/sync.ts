// ============================================================
// Avec Sync Engine
// Pulls data from Avec reports and upserts into local DB.
// Read-only source — no write operations to Avec.
// ============================================================

import { prisma } from "@/lib/prisma";
import { buildAvecClient } from "./client";
import { mapAvecCustomer, mapAvecService, mapAvecAppointment } from "./mappers";
import type { SyncResult, SyncError } from "./types";
import { subDays, addDays } from "date-fns";
import { refreshPostSaleStatus } from "@/modules/post-sale/service";

export async function syncAvecBarbershop(
  barbershopId: string,
  triggeredBy:  string = "manual"
): Promise<SyncResult> {
  const startedAt = Date.now();
  const errors: SyncError[] = [];
  let customersUpserted     = 0;
  let servicesUpserted      = 0;
  let appointmentsUpserted  = 0;
  let customersUpdatedStats = 0;

  const integration = await prisma.integration.findUnique({ where: { barbershopId } });

  if (!integration?.configJson || integration.provider !== "avec") {
    throw new Error("Avec integration not configured for this barbershop");
  }

  const syncRun = await prisma.syncRun.create({
    data: { barbershopId, integrationId: integration.id, status: "RUNNING", triggeredBy },
  });

  try {
    const client = buildAvecClient(integration.configJson);
    const now    = new Date();

    // ── 1. Customers (/reports/0004) ─────────────────────
    try {
      let page = 1, hasMore = true;
      while (hasMore) {
        const res = await client.getCustomers(page, 250);
        for (const raw of res.data) {
          try {
            const isDeleted = await prisma.customer.findFirst({
              where:  { barbershopId, avecId: String(raw.id), deletedAt: { not: null } },
              select: { id: true },
            });
            if (isDeleted) continue;

            const data     = mapAvecCustomer(raw, barbershopId);
            const existing = await prisma.customer.upsert({
              where:  { barbershopId_avecId: { barbershopId, avecId: String(raw.id) } },
              create: data,
              update: { lastSyncedAt: new Date() },
              select: { id: true, locallyModifiedAt: true, phone: true },
            });

            // Only overwrite user-editable fields if never edited locally
            if (!existing.locallyModifiedAt) {
              await prisma.customer.update({
                where: { id: existing.id },
                data:  {
                  name:      data.name,
                  phone:     data.phone,
                  email:     data.email,
                  birthDate: data.birthDate,
                },
              });
            } else if (!existing.phone && data.phone) {
              await prisma.customer.update({
                where: { id: existing.id },
                data:  { phone: data.phone },
              });
            }

            customersUpserted++;
          } catch (err) {
            errors.push({ entity: "Customer", entityId: String(raw.id), message: String(err) });
          }
        }
        hasMore = page < (res.totalPages ?? 1);
        page++;
      }
    } catch (err) {
      errors.push({ entity: "Customers (bulk)", message: String(err) });
    }

    // ── 2. Services (/reports/0031) ──────────────────────
    try {
      const inicio = subDays(now, 90); // wider window to catch all active services
      const fim    = now;
      let page = 1, hasMore = true;
      while (hasMore) {
        const res = await client.getServices(inicio, fim, page, 250);
        for (const raw of res.data) {
          try {
            const data = mapAvecService(raw, barbershopId);
            // Skip soft-deleted services — don't resurrect them
            const existing = await prisma.service.findUnique({
              where: { barbershopId_avecId: { barbershopId, avecId: String(raw.id) } },
              select: { deletedAt: true },
            });
            if (existing?.deletedAt) continue;
            await prisma.service.upsert({
              where:  { barbershopId_avecId: { barbershopId, avecId: String(raw.id) } },
              create: data,
              update: {
                name:           data.name,
                price:          data.price,
                durationMin:    data.durationMin,
                category:       data.category,
                active:         data.active,
                lastSyncedAt:   new Date(),
              },
            });
            servicesUpserted++;
          } catch (err) {
            errors.push({ entity: "Service", entityId: String(raw.id), message: String(err) });
          }
        }
        hasMore = page < (res.totalPages ?? 1);
        page++;
      }
    } catch (err) {
      errors.push({ entity: "Services (bulk)", message: String(err) });
    }

    // ── 3. Appointments (/reports/0051) ──────────────────
    // Last 30 days + next 14 days
    try {
      const inicio = subDays(now, 30);
      const fim    = addDays(now, 14);

      const [customers, services] = await Promise.all([
        prisma.customer.findMany({
          where:  { barbershopId, avecId: { not: null }, deletedAt: null },
          select: { id: true, avecId: true },
        }),
        prisma.service.findMany({
          where:  { barbershopId, avecId: { not: null } },
          select: { id: true, avecId: true },
        }),
      ]);

      const customerMap = new Map(customers.map((c) => [c.avecId!, c.id]));
      const serviceMap  = new Map(services.map((s)  => [s.avecId!, s.id]));

      let page = 1, hasMore = true;
      while (hasMore) {
        const res = await client.getAppointments(inicio, fim, page, 250);
        for (const raw of res.data) {
          try {
            const data = mapAvecAppointment(raw, barbershopId, customerMap, serviceMap);
            await prisma.appointment.upsert({
              where:  { barbershopId_avecId: { barbershopId, avecId: String(raw.id) } },
              create: data,
              update: {
                status:        data.status,
                price:         data.price,
                durationMin:   data.durationMin,
                notes:         data.notes,
                lastSyncedAt:  new Date(),
              },
            });
            appointmentsUpserted++;
          } catch (err) {
            errors.push({ entity: "Appointment", entityId: String(raw.id), message: String(err) });
          }
        }
        hasMore = page < (res.totalPages ?? 1);
        page++;
      }
    } catch (err) {
      errors.push({ entity: "Appointments (bulk)", message: String(err) });
    }

    // ── 4. Customer stats (provider-agnostic) ────────────
    try {
      const aggregates = await prisma.appointment.groupBy({
        by:    ["customerId"],
        where: { barbershopId, customerId: { not: null }, status: { in: ["COMPLETED"] } },
        _count: { _all: true },
        _sum:   { price: true },
        _max:   { scheduledAt: true },
      });

      const lastAppointments = await prisma.appointment.findMany({
        where:   { barbershopId, customerId: { not: null }, status: "COMPLETED" },
        select:  { customerId: true, scheduledAt: true, price: true, service: { select: { name: true } } },
        orderBy: { scheduledAt: "desc" },
      });

      const lastCompletedMap = new Map<string, { price: any; serviceName: string | null }>();
      for (const a of lastAppointments) {
        if (!a.customerId || lastCompletedMap.has(a.customerId)) continue;
        lastCompletedMap.set(a.customerId, { price: a.price, serviceName: a.service?.name ?? null });
      }

      const since60 = new Date(Date.now() - 60 * 86400_000);
      const agg60   = await prisma.appointment.groupBy({
        by:    ["customerId"],
        where: { barbershopId, customerId: { not: null }, status: "COMPLETED", scheduledAt: { gte: since60 } },
        _count: { _all: true },
        _sum:   { price: true },
      });
      const agg60Map = new Map(agg60.map((a) => [a.customerId!, a]));

      for (const agg of aggregates) {
        if (!agg.customerId) continue;
        const last    = lastCompletedMap.get(agg.customerId);
        const w60     = agg60Map.get(agg.customerId);
        const visits60 = w60?._count._all ?? 0;
        const spent60  = Number(w60?._sum.price ?? 0);

        await prisma.customer.update({
          where: { id: agg.customerId },
          data:  {
            totalVisits:                agg._count._all,
            totalSpent:                 agg._sum.price ?? 0,
            lastVisitAt:                agg._max.scheduledAt ?? null,
            lastCompletedAppointmentAt: agg._max.scheduledAt ?? null,
            lastServiceSummary:         last?.serviceName ?? null,
            lastSpentAmount:            last?.price ?? null,
            visitsLast60d:              visits60,
            totalSpentLast60d:          spent60,
            avgTicketLast60d:           visits60 > 0 ? spent60 / visits60 : null,
          },
        });
        customersUpdatedStats++;
      }
    } catch (err) {
      errors.push({ entity: "CustomerStats", message: String(err) });
    }

    // ── 5. nextAppointmentAt (provider-agnostic) ─────────
    try {
      const nowTs   = new Date();
      const upcoming = await prisma.appointment.findMany({
        where:   { barbershopId, customerId: { not: null }, status: { in: ["SCHEDULED", "CONFIRMED"] }, scheduledAt: { gte: nowTs } },
        select:  { customerId: true, scheduledAt: true },
        orderBy: { scheduledAt: "asc" },
      });

      const nextMap = new Map<string, Date>();
      for (const a of upcoming) {
        if (!a.customerId || nextMap.has(a.customerId)) continue;
        nextMap.set(a.customerId, a.scheduledAt);
      }

      await prisma.customer.updateMany({
        where: { barbershopId, deletedAt: null },
        data:  { nextAppointmentAt: null },
      });

      for (const [customerId, scheduledAt] of nextMap) {
        await prisma.customer.update({
          where: { id: customerId },
          data:  { nextAppointmentAt: scheduledAt },
        });
      }
    } catch (err) {
      errors.push({ entity: "NextAppointment", message: String(err) });
    }

    const durationMs = Date.now() - startedAt;
    const status     = errors.length === 0 ? "SUCCESS" : "PARTIAL";

    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data:  { status, customersUpserted, servicesUpserted, appointmentsUpserted, errorsCount: errors.length, errorDetails: errors.length ? JSON.stringify(errors) : null, durationMs, finishedAt: new Date() },
    });

    await prisma.integration.update({
      where: { id: integration.id },
      data:  { lastSyncAt: new Date(), status: "ACTIVE", errorMsg: null },
    });

    // Keep only 10 most recent sync runs
    const allRuns = await prisma.syncRun.findMany({
      where:   { barbershopId },
      orderBy: { startedAt: "desc" },
      select:  { id: true },
    });
    if (allRuns.length > 10) {
      await prisma.syncRun.deleteMany({ where: { id: { in: allRuns.slice(10).map((r) => r.id) } } });
    }

    try {
      await refreshPostSaleStatus(barbershopId);
    } catch (err) {
      errors.push({ entity: "PostSaleStatus", message: String(err) });
    }

    return { customersUpserted, servicesUpserted, appointmentsUpserted, customersUpdatedStats, errors, durationMs };

  } catch (globalErr) {
    const durationMs = Date.now() - startedAt;
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data:  { status: "FAILED", errorsCount: 1, errorDetails: JSON.stringify([{ entity: "Global", message: String(globalErr) }]), durationMs, finishedAt: new Date() },
    });
    await prisma.integration.update({
      where: { id: integration.id },
      data:  { status: "ERROR", errorMsg: String(globalErr) },
    });
    throw globalErr;
  }
}
