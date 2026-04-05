// ============================================================
// Trinks → App Data Mappers
// Field names confirmed via live API call on 2026-03-31
// ============================================================

import type { TrinksCustomer, TrinksService, TrinksAppointment } from "./types";
import type { Prisma, AppointmentStatus, ServiceCategory } from "@prisma/client";

// ── Customer ─────────────────────────────────────────────────

export function mapTrinksCustomer(
  raw: TrinksCustomer,
  barbershopId: string
): Prisma.CustomerUpsertArgs["create"] {
  const phone = raw.telefones?.[0]?.numero ?? null;
  const tags  = raw.etiquetas?.map((e) => e.nome) ?? [];

  return {
    barbershopId,
    trinksId:         String(raw.id),
    name:             raw.nome,
    phone,
    email:            raw.email ?? null,
    birthDate:        raw.dataNascimento ? new Date(raw.dataNascimento) : null,
    notes:            raw.observacao ?? null,
    tags,
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
    trinksId:         String(raw.id),
    name:             raw.nome,
    description:      raw.descricao ?? null,
    price:            raw.preco,
    durationMin:      raw.duracao ?? 30,
    category:         mapServiceCategory(raw.categoria),
    active:           raw.ativo ?? true,
    syncedFromTrinks: true,
    lastSyncedAt:     new Date(),
  };
}

// ── Appointment ──────────────────────────────────────────────
// Uses real field names: dataHoraInicio, duracaoEmMinutos, valor

export function mapTrinksAppointment(
  raw: TrinksAppointment,
  barbershopId:  string,
  customerIdMap: Map<string, string>, // trinksId → internal id
  serviceIdMap:  Map<string, string>,
  barberIdMap:   Map<string, string> = new Map() // trinksProfissionalId → userId
): Prisma.AppointmentUpsertArgs["create"] {
  return {
    barbershopId,
    trinksId:         String(raw.id),
    customerId:       raw.cliente?.id ? (customerIdMap.get(String(raw.cliente.id)) ?? null) : null,
    serviceId:        raw.servico?.id ? (serviceIdMap.get(String(raw.servico.id))  ?? null) : null,
    barberId:         raw.profissional?.id ? (barberIdMap.get(String(raw.profissional.id)) ?? null) : null,
    scheduledAt:      new Date(raw.dataHoraInicio),
    durationMin:      raw.duracaoEmMinutos ?? 30,
    status:           mapAppointmentStatus(raw.status?.nome ?? ""),
    price:            raw.valor ?? null,
    notes:            raw.observacoesDoCliente ?? raw.observacoesDoEstabelecimento ?? null,
    syncedFromTrinks: true,
    lastSyncedAt:     new Date(),
  };
}

// ── Helpers ──────────────────────────────────────────────────

function mapServiceCategory(raw?: string): ServiceCategory {
  if (!raw) return "OTHER";
  const lower = raw.toLowerCase();
  if (lower.includes("corte"))      return "HAIRCUT";
  if (lower.includes("barba"))      return "BEARD";
  if (lower.includes("combo"))      return "COMBO";
  if (lower.includes("tratamento")) return "TREATMENT";
  return "OTHER";
}

function mapAppointmentStatus(raw: string): AppointmentStatus {
  const map: Record<string, AppointmentStatus> = {
    agendado:   "SCHEDULED",
    confirmado: "CONFIRMED",
    finalizado: "COMPLETED",
    cancelado:  "CANCELLED",
  };
  return map[raw?.toLowerCase()] ?? "SCHEDULED";
}
