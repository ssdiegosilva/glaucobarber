// ============================================================
// Trinks Sync Engine
// Pulls data from Trinks and upserts into local DB.
// ============================================================

import { prisma } from "@/lib/prisma";
import { buildTrinksClient } from "./client";
import { mapTrinksCustomer, mapTrinksService, mapTrinksAppointment } from "./mappers";
import type { SyncResult, SyncError } from "./types";
import { subDays, addDays, format } from "date-fns";
import { refreshPostSaleStatus } from "@/modules/post-sale/service";

export async function syncBarbershop(
  barbershopId: string,
  triggeredBy:  string = "manual"
): Promise<SyncResult> {
  const startedAt = Date.now();
  const errors: SyncError[] = [];
  let customersUpserted    = 0;
  let servicesUpserted     = 0;
  let appointmentsUpserted = 0;
  let customersUpdatedStats = 0;

  const integration = await prisma.integration.findUnique({ where: { barbershopId } });

  if (!integration?.configJson) {
    throw new Error("Trinks integration not configured for this barbershop");
  }

  const syncRun = await prisma.syncRun.create({
    data: { barbershopId, integrationId: integration.id, status: "RUNNING", triggeredBy },
  });

  try {
    const client = buildTrinksClient(integration.configJson);

    // ── 1. Customers ──────────────────────────────────────
    try {
      let page = 1, hasMore = true;
      while (hasMore) {
        const res = await client.getCustomers(page, 100);
        for (const raw of res.data) {
          try {
            const data = mapTrinksCustomer(raw, barbershopId);
            await prisma.customer.upsert({
              where:  { barbershopId_trinksId: { barbershopId, trinksId: String(raw.id) } },
              create: data,
              update: { name: data.name, phone: data.phone, email: data.email, notes: data.notes, tags: data.tags, lastSyncedAt: new Date() },
            });
            customersUpserted++;
          } catch (err) {
            errors.push({ entity: "Customer", entityId: String(raw.id), message: String(err) });
          }
        }
        hasMore = page < res.totalPages;
        page++;
      }
    } catch (err) {
      errors.push({ entity: "Customers (bulk)", message: String(err) });
    }

    // ── 2. Services ───────────────────────────────────────
    try {
      const res = await client.getServices();
      for (const raw of res.data) {
        try {
          const data = mapTrinksService(raw, barbershopId);
          await prisma.service.upsert({
            where:  { barbershopId_trinksId: { barbershopId, trinksId: String(raw.id) } },
            create: data,
            update: { name: data.name, description: data.description, price: data.price, durationMin: data.durationMin, category: data.category, active: data.active, lastSyncedAt: new Date() },
          });
          servicesUpserted++;
        } catch (err) {
          errors.push({ entity: "Service", entityId: String(raw.id), message: String(err) });
        }
      }
    } catch (err) {
      errors.push({ entity: "Services (bulk)", message: String(err) });
    }

    // ── 3. Appointments (last 30 days + next 14 days) ────
    try {
      const dataInicio = format(subDays(new Date(), 30), "yyyy-MM-dd'T'00:00:00");
      const dataFim    = format(addDays(new Date(), 14),  "yyyy-MM-dd'T'23:59:59");

      // Build lookup maps from already-synced customers & services
      const [customers, services] = await Promise.all([
        prisma.customer.findMany({ where: { barbershopId, trinksId: { not: null } }, select: { id: true, trinksId: true } }),
        prisma.service.findMany({  where: { barbershopId, trinksId: { not: null } }, select: { id: true, trinksId: true } }),
      ]);
      const customerMap = new Map(customers.map((c) => [c.trinksId!, c.id]));
      const serviceMap  = new Map(services.map((s)  => [s.trinksId!, s.id]));

      let page = 1, hasMore = true;
      while (hasMore) {
        const res = await client.getAppointments({ dataInicio, dataFim, page, pageSize: 100 });
        for (const raw of res.data) {
          try {
            const data = mapTrinksAppointment(raw, barbershopId, customerMap, serviceMap);
            await prisma.appointment.upsert({
              where:  { barbershopId_trinksId: { barbershopId, trinksId: String(raw.id) } },
              create: data,
              update: { status: data.status, price: data.price, durationMin: data.durationMin, notes: data.notes, lastSyncedAt: new Date() },
            });
            appointmentsUpserted++;
          } catch (err) {
            errors.push({ entity: "Appointment", entityId: String(raw.id), message: String(err) });
          }
        }
        hasMore = page < res.totalPages;
        page++;
      }
    } catch (err) {
      errors.push({ entity: "Appointments (bulk)", message: String(err) });
    }

    // ── 4. Atualiza métricas agregadas dos clientes ───────
    try {
      const aggregates = await prisma.appointment.groupBy({
        by: ["customerId"],
        where: {
          barbershopId,
          customerId: { not: null },
          status: { in: ["COMPLETED"] },
        },
        _count: { _all: true },
        _sum:   { price: true },
        _max:   { scheduledAt: true },
      });

      for (const agg of aggregates) {
        if (!agg.customerId) continue;
        await prisma.customer.update({
          where: { id: agg.customerId },
          data: {
            totalVisits:                agg._count._all,
            totalSpent:                 agg._sum.price ?? 0,
            lastVisitAt:                agg._max.scheduledAt ?? null,
            lastCompletedAppointmentAt: agg._max.scheduledAt ?? null,
          },
        });
        customersUpdatedStats++;
      }
    } catch (err) {
      errors.push({ entity: "CustomerStats", message: String(err) });
    }

    // ── 5. Atualiza nextAppointmentAt ─────────────────────
    try {
      const nowTs = new Date();

      // Encontra o próximo agendamento futuro de cada cliente
      const upcoming = await prisma.appointment.findMany({
        where: {
          barbershopId,
          customerId:  { not: null },
          status:      { in: ["SCHEDULED", "CONFIRMED"] },
          scheduledAt: { gte: nowTs },
        },
        select:  { customerId: true, scheduledAt: true },
        orderBy: { scheduledAt: "asc" },
      });

      // Mapa: customerId → data mais próxima
      const nextMap = new Map<string, Date>();
      for (const a of upcoming) {
        if (!a.customerId || nextMap.has(a.customerId)) continue;
        nextMap.set(a.customerId, a.scheduledAt);
      }

      // Limpa nextAppointmentAt de todos (para remover agendamentos cancelados/passados)
      await prisma.customer.updateMany({
        where: { barbershopId },
        data:  { nextAppointmentAt: null },
      });

      // Reaplica apenas os que têm agendamento futuro real
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
      data: { status, customersUpserted, servicesUpserted, appointmentsUpserted, errorsCount: errors.length, errorDetails: errors.length ? JSON.stringify(errors) : null, durationMs, finishedAt: new Date() },
    });

    await prisma.integration.update({
      where: { id: integration.id },
      data: { lastSyncAt: new Date(), status: "ACTIVE", errorMsg: null },
    });

    // Refresh post-sale status after full sync
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
      data: { status: "FAILED", errorsCount: 1, errorDetails: JSON.stringify([{ entity: "Global", message: String(globalErr) }]), durationMs, finishedAt: new Date() },
    });
    await prisma.integration.update({
      where: { id: integration.id },
      data: { status: "ERROR", errorMsg: String(globalErr) },
    });
    throw globalErr;
  }
}
