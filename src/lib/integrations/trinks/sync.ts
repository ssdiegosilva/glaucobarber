// ============================================================
// Trinks Sync Engine
// Pulls data from Trinks and upserts into local DB.
// ============================================================

import { prisma } from "@/lib/prisma";
import { buildTrinksClient } from "./client";
import { mapTrinksCustomer, mapTrinksService, mapTrinksAppointment } from "./mappers";
import type { SyncResult, SyncError, TrinksAppointment } from "./types";
import { subDays, addDays, format } from "date-fns";
import { refreshPostSaleStatus, refreshCustomer60dStats } from "@/modules/post-sale/service";
import { createAppointmentBillingEvent } from "@/lib/billing";

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
            // Skip customers that were locally deleted — never resurrect them
            const isDeleted = await prisma.customer.findFirst({
              where:  { barbershopId, trinksId: String(raw.id), deletedAt: { not: null } },
              select: { id: true },
            });
            if (isDeleted) continue;

            // List endpoint may not return telefones — fetch detail if missing
            if (!raw.telefones?.length) {
              try {
                const detail = await client.getCustomerDetail(raw.id);
                if (detail.telefones?.length) {
                  raw.telefones = detail.telefones;
                }
              } catch {
                // Detail fetch failed — proceed without phone
              }
            }

            const data = mapTrinksCustomer(raw, barbershopId);
            const existing = await prisma.customer.upsert({
              where:  { barbershopId_trinksId: { barbershopId, trinksId: String(raw.id) } },
              create: data,
              // Only update the sync timestamp here — user-editable fields are protected below
              update: { lastSyncedAt: new Date() },
              select: { id: true, locallyModifiedAt: true, phone: true },
            });
            // Only overwrite user-editable fields if the customer was never edited locally
            if (!existing.locallyModifiedAt) {
              await prisma.customer.update({
                where: { id: existing.id },
                data:  { name: data.name, phone: data.phone, email: data.email, notes: data.notes, tags: data.tags },
              });
            } else if (!existing.phone && data.phone) {
              // Even if locally modified, fill in phone if it was missing
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
      const [customers, services, barberMemberships] = await Promise.all([
        prisma.customer.findMany({ where: { barbershopId, trinksId: { not: null }, deletedAt: null }, select: { id: true, trinksId: true } }),
        prisma.service.findMany({  where: { barbershopId, trinksId: { not: null } }, select: { id: true, trinksId: true } }),
        prisma.membership.findMany({ where: { barbershopId, trinksId: { not: null }, role: "BARBER" }, select: { userId: true, trinksId: true } }),
      ]);
      const customerMap = new Map(customers.map((c) => [c.trinksId!, c.id]));
      const serviceMap  = new Map(services.map((s)  => [s.trinksId!, s.id]));
      // Map trinksProfissionalId → userId for barber assignment
      const barberMap   = new Map(barberMemberships.map((m) => [m.trinksId!, m.userId]));

      // Auto-create barber memberships for unknown Trinks professionals
      // Collect unique professionals from appointments first pass
      let page = 1, hasMore = true;
      const allRawAppointments: TrinksAppointment[] = [];
      const unseenPros = new Map<string, string>(); // trinksId → nome

      // First: collect all appointment data and discover new professionals
      while (hasMore) {
        const res = await client.getAppointments({ dataInicio, dataFim, page, pageSize: 100 });
        for (const raw of res.data) {
          allRawAppointments.push(raw);
          if (raw.profissional?.id && !barberMap.has(String(raw.profissional.id))) {
            unseenPros.set(String(raw.profissional.id), raw.profissional.nome);
          }
        }
        hasMore = page < res.totalPages;
        page++;
      }

      // Auto-create placeholder users + memberships for new professionals
      for (const [trinksProId, proName] of unseenPros) {
        try {
          const placeholderEmail = `trinks-pro-${trinksProId}@placeholder.glaucobarber.com`;
          const user = await prisma.user.upsert({
            where:  { email: placeholderEmail },
            create: { email: placeholderEmail, name: proName },
            update: {},
            select: { id: true },
          });
          await prisma.membership.upsert({
            where:  { barbershopId_trinksId: { barbershopId, trinksId: trinksProId } },
            create: { userId: user.id, barbershopId, role: "BARBER", trinksId: trinksProId },
            update: {},
          });
          barberMap.set(trinksProId, user.id);
        } catch (err) {
          errors.push({ entity: "BarberAutoCreate", entityId: trinksProId, message: String(err) });
        }
      }

      // Second: upsert all appointments with barber mapping
      for (const raw of allRawAppointments) {
        try {
          const data = mapTrinksAppointment(raw, barbershopId, customerMap, serviceMap, barberMap);
          const upserted = await prisma.appointment.upsert({
            where:  { barbershopId_trinksId: { barbershopId, trinksId: String(raw.id) } },
            create: data,
            update: { status: data.status, price: data.price, durationMin: data.durationMin, notes: data.notes, barberId: data.barberId, lastSyncedAt: new Date() },
            select: { id: true },
          });
          if (data.status === "COMPLETED") {
            createAppointmentBillingEvent(barbershopId, upserted.id).catch(() => null);
          }
          appointmentsUpserted++;
        } catch (err) {
          errors.push({ entity: "Appointment", entityId: String(raw.id), message: String(err) });
        }
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

      // Fetch last completed appointment per customer for lastServiceSummary + lastSpentAmount
      const lastCompletedMap = new Map<string, { price: any; serviceName: string | null }>();
      const lastAppointments = await prisma.appointment.findMany({
        where: { barbershopId, customerId: { not: null }, status: "COMPLETED" },
        select: { customerId: true, scheduledAt: true, price: true, service: { select: { name: true } } },
        orderBy: { scheduledAt: "desc" },
      });
      for (const a of lastAppointments) {
        if (!a.customerId || lastCompletedMap.has(a.customerId)) continue;
        lastCompletedMap.set(a.customerId, { price: a.price, serviceName: a.service?.name ?? null });
      }

      const since60 = new Date(Date.now() - 60 * 86400_000);
      const agg60 = await prisma.appointment.groupBy({
        by: ["customerId"],
        where: { barbershopId, customerId: { not: null }, status: "COMPLETED", scheduledAt: { gte: since60 } },
        _count: { _all: true },
        _sum:   { price: true },
      });
      const agg60Map = new Map(agg60.map((a) => [a.customerId!, a]));

      for (const agg of aggregates) {
        if (!agg.customerId) continue;
        const last = lastCompletedMap.get(agg.customerId);
        const w60  = agg60Map.get(agg.customerId);
        const visits60 = w60?._count._all ?? 0;
        const spent60  = Number(w60?._sum.price ?? 0);

        await prisma.customer.update({
          where: { id: agg.customerId },
          data: {
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
        where: { barbershopId, deletedAt: null },
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

    // Keep only the 10 most recent sync runs
    const allRuns = await prisma.syncRun.findMany({
      where:   { barbershopId },
      orderBy: { startedAt: "desc" },
      select:  { id: true },
    });
    if (allRuns.length > 10) {
      const toDelete = allRuns.slice(10).map((r) => r.id);
      await prisma.syncRun.deleteMany({ where: { id: { in: toDelete } } });
    }

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
