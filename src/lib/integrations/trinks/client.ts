// ============================================================
// Trinks API Client
//
// This is a typed HTTP adapter around the Trinks API.
// All external HTTP calls are isolated here.
//
// IMPORTANT: The base URL and exact endpoint paths must be
// confirmed against official Trinks API documentation.
// Endpoints marked [VERIFY] are educated guesses based on
// common REST patterns.
// ============================================================

import type {
  TrinksConfig,
  TrinksCustomer,
  TrinksService,
  TrinksAppointment,
  TrinksPage,
} from "./types";

const DEFAULT_BASE_URL = "https://api.trinks.com"; // [VERIFY]
const DEFAULT_TIMEOUT  = 10_000;

export class TrinksClient {
  private readonly baseUrl: string;
  private readonly apiKey:  string;
  private readonly companyId: string;

  constructor(config: TrinksConfig) {
    this.apiKey    = config.apiKey;
    this.companyId = config.companyId;
    this.baseUrl   = config.baseUrl ?? process.env.TRINKS_API_BASE_URL ?? DEFAULT_BASE_URL;
  }

  // ── Private HTTP helper ──────────────────────────────────

  private async request<T>(
    method: "GET" | "POST" | "PUT" | "PATCH",
    path: string,
    options?: {
      params?: Record<string, string | number>;
      body?:   unknown;
    }
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);

    if (options?.params) {
      Object.entries(options.params).forEach(([k, v]) =>
        url.searchParams.set(k, String(v))
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    try {
      const res = await fetch(url.toString(), {
        method,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          // [VERIFY] Auth header format – adjust to what Trinks actually uses
          "Authorization": `Bearer ${this.apiKey}`,
          "X-Company-Id":  this.companyId,
        },
        body: options?.body ? JSON.stringify(options.body) : undefined,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new TrinksApiError(
          `Trinks API error: ${res.status} ${res.statusText}`,
          res.status,
          text
        );
      }

      return res.json() as Promise<T>;
    } finally {
      clearTimeout(timeout);
    }
  }

  // ── Customers ────────────────────────────────────────────

  async getCustomers(page = 1, perPage = 100): Promise<TrinksPage<TrinksCustomer>> {
    // [VERIFY] endpoint path
    return this.request("GET", "/v1/clients", { params: { page, per_page: perPage } });
  }

  async getCustomer(id: string): Promise<TrinksCustomer> {
    return this.request("GET", `/v1/clients/${id}`);
  }

  // ── Services ─────────────────────────────────────────────

  async getServices(): Promise<TrinksPage<TrinksService>> {
    // [VERIFY] endpoint path
    return this.request("GET", "/v1/services", { params: { page: 1, per_page: 200 } });
  }

  // ── Appointments ─────────────────────────────────────────

  async getAppointments(opts: {
    dateFrom: string; // ISO date "YYYY-MM-DD"
    dateTo:   string;
    page?:    number;
    perPage?: number;
  }): Promise<TrinksPage<TrinksAppointment>> {
    // [VERIFY] endpoint path and param names
    return this.request("GET", "/v1/appointments", {
      params: {
        date_from: opts.dateFrom,
        date_to:   opts.dateTo,
        page:      opts.page ?? 1,
        per_page:  opts.perPage ?? 100,
      },
    });
  }

  async getTodayAppointments(): Promise<TrinksPage<TrinksAppointment>> {
    const today = new Date().toISOString().split("T")[0];
    return this.getAppointments({ dateFrom: today, dateTo: today });
  }

  // ── Health check ─────────────────────────────────────────

  async ping(): Promise<boolean> {
    try {
      // [VERIFY] Use a lightweight endpoint to test connectivity
      await this.request("GET", "/v1/ping");
      return true;
    } catch {
      return false;
    }
  }
}

// ── Error class ──────────────────────────────────────────────

export class TrinksApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly body: string
  ) {
    super(message);
    this.name = "TrinksApiError";
  }
}

// ── Factory: builds client from stored Integration config ───

export function buildTrinksClient(configJson: string): TrinksClient {
  const config = JSON.parse(configJson) as TrinksConfig;
  return new TrinksClient(config);
}
