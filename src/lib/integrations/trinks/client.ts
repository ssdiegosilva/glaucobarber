// ============================================================
// Trinks API Client
// Base URL: https://api.trinks.com
// Auth: header "X-Api-Key" + header "estabelecimentoId"
// Docs: https://trinks.readme.io/reference/introducao
// ============================================================

import type {
  TrinksConfig,
  TrinksCustomer,
  TrinksEstabelecimento,
  TrinksService,
  TrinksAppointment,
  TrinksPage,
} from "./types";

const DEFAULT_BASE_URL = "https://api.trinks.com";
const DEFAULT_TIMEOUT  = 15_000;
const MAX_RETRIES      = 5;
const MAX_BACKOFF_MS   = 30_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Parse Retry-After header: either "<seconds>" or HTTP date.
// Returns milliseconds to wait, or null if header is missing/unparseable.
function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const asInt = parseInt(header, 10);
  if (!Number.isNaN(asInt)) return Math.max(0, asInt * 1000);
  const asDate = Date.parse(header);
  if (!Number.isNaN(asDate)) return Math.max(0, asDate - Date.now());
  return null;
}

export class TrinksClient {
  private readonly baseUrl:            string;
  private readonly apiKey:             string;
  private readonly estabelecimentoId:  string;

  constructor(config: TrinksConfig) {
    this.apiKey            = config.apiKey;
    this.estabelecimentoId = config.estabelecimentoId ?? "";
    this.baseUrl           = config.baseUrl ?? DEFAULT_BASE_URL;
  }

  // ── Private HTTP helper ──────────────────────────────────

  private async request<T>(
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    path:   string,
    options?: {
      params?: Record<string, string | number | boolean>;
      body?:   unknown;
    }
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);

    if (options?.params) {
      Object.entries(options.params).forEach(([k, v]) =>
        url.searchParams.set(k, String(v))
      );
    }

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeout    = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

      try {
        const res = await fetch(url.toString(), {
          method,
          signal: controller.signal,
          headers: {
            "Content-Type":    "application/json",
            "X-Api-Key":       this.apiKey,
            "estabelecimentoId": this.estabelecimentoId,
          },
          body: options?.body ? JSON.stringify(options.body) : undefined,
        });

        // Honor rate limiting: 429 (Too Many Requests) and 503 (Service Unavailable) are retriable
        if ((res.status === 429 || res.status === 503) && attempt < MAX_RETRIES) {
          const retryAfter = parseRetryAfter(res.headers.get("retry-after"));
          const backoff    = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt);
          const waitMs     = retryAfter ?? backoff;
          console.warn(`[trinks] ${res.status} on ${path}, retrying in ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await sleep(waitMs);
          continue;
        }

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new TrinksApiError(
            `Trinks API ${res.status} ${res.statusText}: ${path}`,
            res.status,
            text
          );
        }

        return res.json() as Promise<T>;
      } finally {
        clearTimeout(timeout);
      }
    }

    // Exhausted retries on 429/503
    throw new TrinksApiError(
      `Trinks API rate limit exhausted after ${MAX_RETRIES} retries: ${path}`,
      429,
      ""
    );
  }

  // ── Establishments ───────────────────────────────────────

  async getEstabelecimentos(): Promise<TrinksPage<TrinksEstabelecimento>> {
    // No estabelecimentoId header needed for this endpoint
    const url = new URL(`${this.baseUrl}/v1/estabelecimentos`);
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
    try {
      const res = await fetch(url.toString(), {
        headers: { "X-Api-Key": this.apiKey, "Content-Type": "application/json" },
        signal: controller.signal,
      });
      return res.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  // ── Customers ────────────────────────────────────────────

  async getCustomers(page = 1, pageSize = 100): Promise<TrinksPage<TrinksCustomer>> {
    return this.request("GET", "/v1/clientes", {
      params: { page, pageSize, incluirDetalhes: true },
    });
  }

  async getCustomerDetail(trinksId: number | string): Promise<TrinksCustomer> {
    return this.request("GET", `/v1/clientes/${trinksId}`);
  }

  // ── Services ─────────────────────────────────────────────

  async getServices(page = 1, pageSize = 200): Promise<TrinksPage<TrinksService>> {
    return this.request("GET", "/v1/servicos", { params: { page, pageSize } });
  }

  // ── Appointments ─────────────────────────────────────────

  async getAppointments(opts: {
    dataInicio: string; // ISO datetime "YYYY-MM-DDTHH:mm:ss"
    dataFim:    string;
    page?:      number;
    pageSize?:  number;
  }): Promise<TrinksPage<TrinksAppointment>> {
    return this.request("GET", "/v1/agendamentos", {
      params: {
        dataInicio: opts.dataInicio,
        dataFim:    opts.dataFim,
        page:       opts.page ?? 1,
        pageSize:   opts.pageSize ?? 100,
      },
    });
  }

  async getTodayAppointments(): Promise<TrinksPage<TrinksAppointment>> {
    const now   = new Date();
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const end   = new Date(now); end.setHours(23, 59, 59, 999);
    return this.getAppointments({
      dataInicio: start.toISOString().slice(0, 19),
      dataFim:    end.toISOString().slice(0, 19),
    });
  }

  // ── Appointment status update ────────────────────────────

  async updateAppointmentStatus(
    agendamentoId: string | number,
    status: "confirmado" | "cancelado" | "finalizado" | "clientefaltou" | "ematendimento"
  ): Promise<void> {
    await this.request("PATCH", `/v1/agendamentos/${agendamentoId}/status/${status}`);
  }

  // ── Appointment reschedule ───────────────────────────────

  async rescheduleAppointment(
    agendamentoId: string | number,
    newDateTimeIso: string  // ISO datetime "YYYY-MM-DDTHH:mm:ss"
  ): Promise<void> {
    await this.request("PATCH", `/v1/agendamentos/${agendamentoId}`, {
      body: { dataHoraInicio: newDateTimeIso },
    });
  }

  // ── Health check ─────────────────────────────────────────

  async ping(): Promise<boolean> {
    try {
      await this.request("GET", "/v1/clientes", { params: { page: 1, pageSize: 1 } });
      return true;
    } catch {
      return false;
    }
  }
}

// ── Error ────────────────────────────────────────────────────

export class TrinksApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly body:       string
  ) {
    super(message);
    this.name = "TrinksApiError";
  }
}

// ── Factory ──────────────────────────────────────────────────

export function buildTrinksClient(configJson: string): TrinksClient {
  const config = JSON.parse(configJson) as TrinksConfig;
  return new TrinksClient(config);
}
