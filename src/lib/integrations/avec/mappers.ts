// ============================================================
// Avec → App Data Mappers
// NOTE: Avec API does not document status values explicitly.
// Status mappings below are based on common Brazilian salon
// management conventions. Validate against live API on first
// real connection and update mapAvecAppointmentStatus() as needed.
// ============================================================

import type { AvecCustomer, AvecService, AvecAppointment } from "./types";
import type { Prisma, AppointmentStatus, ServiceCategory } from "@prisma/client";
import { parse, isValid } from "date-fns";

// ── Customer ─────────────────────────────────────────────────

export function mapAvecCustomer(
  raw: AvecCustomer,
  barbershopId: string
): Prisma.CustomerUpsertArgs["create"] {
  const phone = normalizePhone(raw.celular ?? raw.telefone);

  return {
    barbershopId,
    avecId:          String(raw.id),
    name:            raw.nome,
    phone,
    email:           raw.email ?? null,
    birthDate:       parseBrDate(raw.nascimento),
    syncedFromAvec:  true,
    lastSyncedAt:    new Date(),
  };
}

// ── Service ──────────────────────────────────────────────────

export function mapAvecService(
  raw: AvecService,
  barbershopId: string
): Prisma.ServiceUpsertArgs["create"] {
  return {
    barbershopId,
    avecId:          String(raw.id),
    name:            raw.nome,
    price:           raw.valor ?? 0,
    durationMin:     raw.duracao ?? 30,
    category:        mapServiceCategory(raw.categoria),
    active:          raw.ativo ?? true,
    syncedFromAvec:  true,
    lastSyncedAt:    new Date(),
  };
}

// ── Appointment ──────────────────────────────────────────────

export function mapAvecAppointment(
  raw:          AvecAppointment,
  barbershopId: string,
  customerMap:  Map<string, string>, // avecId → internal customerId
  serviceMap:   Map<string, string>  // avecId → internal serviceId
): Prisma.AppointmentUpsertArgs["create"] {
  const scheduledAt = parseAvecDateTime(raw.data, raw.hora);

  return {
    barbershopId,
    avecId:          String(raw.id),
    customerId:      raw.cliente?.id ? (customerMap.get(String(raw.cliente.id)) ?? null) : null,
    serviceId:       raw.servico?.id  ? (serviceMap.get(String(raw.servico.id))  ?? null) : null,
    scheduledAt:     scheduledAt ?? new Date(),
    durationMin:     raw.duracao  ?? 30,
    status:          mapAvecAppointmentStatus(raw.status ?? ""),
    price:           raw.valor    ?? null,
    notes:           raw.observacao ?? null,
    syncedFromAvec:  true,
    lastSyncedAt:    new Date(),
  };
}

// ── Status mapping ───────────────────────────────────────────
// Avec status values are undocumented — mappings are inferred.
// Unknown values default to SCHEDULED and are logged for validation.

export function mapAvecAppointmentStatus(raw: string): AppointmentStatus {
  const normalized = raw.toLowerCase().trim();

  const map: Record<string, AppointmentStatus> = {
    "agendado":           "SCHEDULED",
    "pendente":           "SCHEDULED",
    "confirmado":         "CONFIRMED",
    "em andamento":       "IN_PROGRESS",
    "em atendimento":     "IN_PROGRESS",
    "finalizado":         "COMPLETED",
    "concluido":          "COMPLETED",
    "concluído":          "COMPLETED",
    "cancelado":          "CANCELLED",
    "cliente faltou":     "NO_SHOW",
    "não compareceu":     "NO_SHOW",
    "nao compareceu":     "NO_SHOW",
  };

  const mapped = map[normalized];
  if (!mapped && normalized) {
    // Log unknown status to help validate actual Avec status values
    console.warn(`[Avec] Unknown appointment status: "${raw}" — defaulting to SCHEDULED`);
  }

  return mapped ?? "SCHEDULED";
}

// ── Helpers ──────────────────────────────────────────────────

function mapServiceCategory(raw?: string | null): ServiceCategory {
  if (!raw) return "OTHER";
  const lower = raw.toLowerCase();
  if (lower.includes("corte"))      return "HAIRCUT";
  if (lower.includes("barba"))      return "BEARD";
  if (lower.includes("combo"))      return "COMBO";
  if (lower.includes("tratamento")) return "TREATMENT";
  return "OTHER";
}

function parseBrDate(raw?: string | null): Date | null {
  if (!raw) return null;
  const parsed = parse(raw, "dd/MM/yyyy", new Date());
  return isValid(parsed) ? parsed : null;
}

function parseAvecDateTime(date?: string | null, time?: string | null): Date | null {
  if (!date) return null;
  const dateStr = time ? `${date} ${time}` : date;
  const fmt     = time ? "dd/MM/yyyy HH:mm" : "dd/MM/yyyy";
  const parsed  = parse(dateStr, fmt, new Date());
  return isValid(parsed) ? parsed : null;
}

function normalizePhone(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  // Add Brazil country code if missing
  if (digits.length === 11 || digits.length === 10) return `+55${digits}`;
  if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
  return `+${digits}`;
}
