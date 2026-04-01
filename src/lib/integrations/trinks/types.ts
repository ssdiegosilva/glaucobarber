// ============================================================
// Trinks Integration – Type Contracts
// Base URL: https://api.trinks.com
// Auth: header "X-Api-Key" + header "estabelecimentoId"
// Docs: https://trinks.readme.io/reference/introducao
// ============================================================

export interface TrinksConfig {
  apiKey:            string; // X-Api-Key header
  estabelecimentoId: string; // required on all requests (numeric ID as string)
  baseUrl?:          string; // defaults to https://api.trinks.com
}

// ── Pagination ─────────────────────────────────────────────
// Real response: { data: [], page, pageSize, totalPages, totalRecords }

export interface TrinksPage<T> {
  data:         T[];
  page:         number;
  pageSize:     number;
  totalPages:   number;
  totalRecords: number;
}

// ── Establishment ─────────────────────────────────────────

export interface TrinksEstabelecimento {
  id:   number;
  nome: string;
  cnpj: string;
}

// ── Customer ───────────────────────────────────────────────

export interface TrinksCustomer {
  id:             number;
  nome:           string;
  email?:         string;
  cpf?:           string;
  dataNascimento?: string;
  observacao?:    string;
  telefones?:     { numero: string; tipo?: string }[];
  etiquetas?:     { id: number; nome: string }[];
  dataCadastro?:  string;
  dataAlteracao?: string;
}

// ── Service ────────────────────────────────────────────────

export interface TrinksService {
  id:        number;
  nome:      string;
  descricao?: string;
  preco:     number;   // BRL float e.g. 100.00
  duracao:   number;   // minutes
  categoria?: string;
  ativo?:    boolean;
}

// ── Appointment ────────────────────────────────────────────
// Real field names from API (confirmed via live call)

export interface TrinksAppointment {
  id:              number;
  status: {
    id:   number;
    nome: string; // "Confirmado" | "Finalizado" | "Cancelado" | "Agendado"
  };
  cliente?: {
    id:   number;
    nome: string;
  };
  servico?: {
    id:   number;
    nome: string;
  };
  profissional?: {
    id:   number;
    nome: string;
  };
  dataHoraInicio:              string;  // ISO datetime
  duracaoEmMinutos:            number;
  valor:                       number;  // BRL float
  observacoesDoEstabelecimento?: string | null;
  observacoesDoCliente?:         string | null;
}

// ── Sync result ────────────────────────────────────────────

export interface SyncResult {
  customersUpserted:    number;
  servicesUpserted:     number;
  appointmentsUpserted: number;
  errors:               SyncError[];
  durationMs:           number;
}

export interface SyncError {
  entity:    string;
  entityId?: string;
  message:   string;
}
