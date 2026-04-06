// ============================================================
// Avec API Types
// Base URL: configurable per barbershop (stored in Integration.configJson)
// Auth: Authorization: Bearer <token>
// Docs: https://doc.api.avec.beauty/llms.txt
// ============================================================

// ── Config ───────────────────────────────────────────────────

export interface AvecConfig {
  token:   string;
  baseUrl: string;
}

// ── Pagination ───────────────────────────────────────────────

export interface AvecPage<T> {
  data:        T[];
  totalPages:  number;
  currentPage: number;
  total?:      number;
}

// ── Customer (/reports/0004 + /reports/0002) ─────────────────

export interface AvecCustomer {
  id:           string | number;
  nome:         string;
  email?:       string | null;
  telefone?:    string | null;
  celular?:     string | null;
  nascimento?:  string | null; // dd/MM/yyyy
  // fields from /reports/0002 (attended clients)
  visitas?:     number | null;
  totalGasto?:  number | null;
}

// ── Service (/reports/0031) ──────────────────────────────────

export interface AvecService {
  id:        string | number;
  nome:      string;
  categoria?: string | null;
  valor?:    number | null;
  duracao?:  number | null; // minutes
  ativo?:    boolean;
}

// ── Appointment (/reports/0051) ──────────────────────────────

export interface AvecAppointment {
  id:            string | number;
  cliente?:      { id: string | number; nome: string } | null;
  servico?:      { id: string | number; nome: string } | null;
  profissional?: { id: string | number; nome: string } | null;
  data?:         string | null; // dd/MM/yyyy
  hora?:         string | null; // HH:mm
  duracao?:      number | null; // minutes
  valor?:        number | null;
  status?:       string | null;
  observacao?:   string | null;
}

// ── Sync Result (shared with Trinks) ────────────────────────

export interface SyncResult {
  customersUpserted:     number;
  servicesUpserted:      number;
  appointmentsUpserted:  number;
  customersUpdatedStats: number;
  errors:                SyncError[];
  durationMs:            number;
}

export interface SyncError {
  entity:    string;
  entityId?: string;
  message:   string;
}
