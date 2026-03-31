// ============================================================
// Trinks → App Data Mappers
// Transforms raw Trinks API shapes into Prisma-ready objects
// ============================================================

import type { TrinksCustomer, TrinksService, TrinksAppointment } from "./types";
import type { Prisma, AppointmentStatus, ServiceCategory } from "@prisma/client";

// ── Customer ─────────────────────────────────────────────────

export function mapTrinksCustomer(
  raw: TrinksCustomer,
  barbershopId: string
): Prisma.CustomerUpsertArgs["create"] {
  return {
    barbershopId,
    trinksId:         raw.id,
    name:             raw.name,
    phone:            raw.phone ?? null,
    email:            raw.email ?? null,
    birthDate:        raw.birthDate ? parseTrinksDate(raw.birthDate) : null,
    notes:            raw.notes ?? null,
    tags:             normalizeTags(raw.tags),
    syncedFromTrinks: true,
    lastSyncedAt:     new Date(),
  };
}

// ── Service ──────────────────────────────────────────────────

export function mapTrinksService(
  raw: TrinksService,
  barbershopId: string
): Prisma.ServiceUpsertArgs["create"] {
  return {
    barbershopId,
    trinksId:         raw.id,
    name:             raw.name,
    description:      raw.description ?? null,
    price:            normalizePriceToBRL(raw.price),
    durationMin:      raw.duration ?? 30,
    category:         mapServiceCategory(raw.category),
    active:           raw.active ?? true,
    syncedFromTrinks: true,
    lastSyncedAt:     new Date(),
  };
}

// ── Appointment ──────────────────────────────────────────────

export function mapTrinksAppointment(
  raw: TrinksAppointment,
  barbershopId: string,
  customerIdMap: Map<string, string>,  // trinksId → internal id
  serviceIdMap:  Map<string, string>
): Prisma.AppointmentUpsertArgs["create"] {
  const scheduledAt = new Date(raw.startTime);
  let durationMin = 30;

  if (raw.endTime) {
    const end   = new Date(raw.endTime);
    durationMin = Math.round((end.getTime() - scheduledAt.getTime()) / 60_000);
  }

  return {
    barbershopId,
    trinksId:         raw.id,
    customerId:       raw.clientId  ? (customerIdMap.get(raw.clientId)  ?? null) : null,
    serviceId:        raw.serviceId ? (serviceIdMap.get(raw.serviceId)  ?? null) : null,
    scheduledAt,
    durationMin,
    status:           mapAppointmentStatus(raw.status),
    price:            raw.price != null ? normalizePriceToBRL(raw.price) : null,
    notes:            raw.notes ?? null,
    syncedFromTrinks: true,
    lastSyncedAt:     new Date(),
  };
}

// ── Helpers ──────────────────────────────────────────────────

function parseTrinksDate(raw: string): Date | null {
  // Handle "dd/MM/yyyy" or ISO formats
  if (raw.includes("/")) {
    const [d, m, y] = raw.split("/");
    return new Date(`${y}-${m}-${d}`);
  }
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function normalizeTags(tags?: string[] | string): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  return tags.split(",").map((t) => t.trim()).filter(Boolean);
}

function normalizePriceToBRL(price: number): number {
  // [VERIFY] If Trinks returns prices in cents, divide by 100.
  // If it returns as float BRL, return as-is.
  // Assuming float BRL for now (e.g. 45.00):
  return price;
}

function mapServiceCategory(raw?: string): ServiceCategory {
  const map: Record<string, ServiceCategory> = {
    corte:      "HAIRCUT",
    haircut:    "HAIRCUT",
    barba:      "BEARD",
    beard:      "BEARD",
    combo:      "COMBO",
    tratamento: "TREATMENT",
    treatment:  "TREATMENT",
  };
  return map[raw?.toLowerCase() ?? ""] ?? "OTHER";
}

function mapAppointmentStatus(raw: string): AppointmentStatus {
  const map: Record<string, AppointmentStatus> = {
    scheduled:    "SCHEDULED",
    confirmed:    "CONFIRMED",
    in_progress:  "IN_PROGRESS",
    done:         "COMPLETED",
    completed:    "COMPLETED",
    canceled:     "CANCELLED",
    cancelled:    "CANCELLED",
    no_show:      "NO_SHOW",
  };
  return map[raw?.toLowerCase()] ?? "SCHEDULED";
}
