import { differenceInCalendarDays } from "date-fns";

import type { PostSaleStatus } from "./types";

interface StatusInput {
  lastCompletedAt?: Date | null;
  nextAppointmentAt?: Date | null;
  inactiveAt?: Date | null;
  reactivatedAt?: Date | null;
  doNotContact?: boolean;
}

const DAYS_RISK = 14;
const DAYS_INACTIVE = 60;

export function computePostSaleStatus(input: StatusInput): PostSaleStatus | null {
  if (input.doNotContact) return "NAO_CONTATAR";

  const today = new Date();
  const last = input.lastCompletedAt ? new Date(input.lastCompletedAt) : undefined;
  const next = input.nextAppointmentAt ? new Date(input.nextAppointmentAt) : undefined;

  if (next && next > today) return "RECENTE"; // já tem agendamento futuro, não entra em risco

  // Sem histórico de visita e sem agendamento → cliente novo, sem status de pós-venda
  if (!last) return null;

  const days = differenceInCalendarDays(today, last);

  if (input.reactivatedAt && input.reactivatedAt > (input.inactiveAt ?? new Date(0))) {
    return "REATIVADO";
  }

  if (days > DAYS_INACTIVE) return "INATIVO";
  if (days > DAYS_RISK) return "EM_RISCO";
  return "RECENTE";
}

export const STATUS_WINDOWS = {
  risk: DAYS_RISK,
  inactive: DAYS_INACTIVE,
};
