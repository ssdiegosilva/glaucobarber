// ============================================================
// Trinks Integration – Type Contracts
//
// IMPORTANT: These types define the expected shape of data
// from the Trinks API. They are based on publicly known
// patterns of the Trinks platform and may need adjustment
// once you obtain official API documentation/access.
//
// Fields marked [VERIFY] need confirmation against real docs.
// ============================================================

// ── Credentials stored in Integration.configJson ──────────

export interface TrinksConfig {
  apiKey:     string;     // [VERIFY] Trinks API key or token
  companyId:  string;     // [VERIFY] Trinks company/tenant ID
  baseUrl?:   string;     // Optional override; defaults to TRINKS_API_BASE_URL
}

// ── Raw API response shapes ────────────────────────────────
// These represent what the Trinks API returns.
// Adjust field names once you have real API access.

export interface TrinksCustomer {
  id:         string;       // [VERIFY] Trinks client ID
  name:       string;
  phone?:     string;
  email?:     string;
  birthDate?: string;       // [VERIFY] ISO date or "dd/MM/yyyy"
  tags?:      string[];     // [VERIFY] may be string csv
  notes?:     string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TrinksService {
  id:           string;
  name:         string;
  description?: string;
  price:        number;     // [VERIFY] cents or float BRL
  duration:     number;     // [VERIFY] minutes
  category?:    string;     // [VERIFY] category label
  active?:      boolean;
}

export interface TrinksAppointment {
  id:          string;
  clientId?:   string;      // [VERIFY] maps to TrinksCustomer.id
  serviceId?:  string;
  barberId?:   string;
  startTime:   string;      // [VERIFY] ISO datetime
  endTime?:    string;
  status:      string;      // [VERIFY] e.g. "scheduled" | "done" | "canceled"
  price?:      number;
  notes?:      string;
}

// ── Pagination wrapper (assumed) ───────────────────────────
export interface TrinksPage<T> {
  data:        T[];
  total:       number;
  page:        number;
  perPage:     number;
  totalPages:  number;
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
