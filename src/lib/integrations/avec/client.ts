// ============================================================
// Avec API Client
// Auth: Authorization: Bearer <token>
// Dates: dd/MM/yyyy format
// All endpoints are read-only reports — no write operations
// ============================================================

import type { AvecConfig, AvecPage, AvecCustomer, AvecService, AvecAppointment } from "./types";
import { format } from "date-fns";

const DEFAULT_TIMEOUT = 15_000;

export class AvecClient {
  private readonly baseUrl: string;
  private readonly token:   string;

  constructor(config: AvecConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.token   = config.token;
  }

  // ── Private HTTP helper ──────────────────────────────────

  private async request<T>(
    path:    string,
    params?: Record<string, string | number>
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);

    if (params) {
      Object.entries(params).forEach(([k, v]) =>
        url.searchParams.set(k, String(v))
      );
    }

    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    try {
      const res = await fetch(url.toString(), {
        method:  "GET",
        signal:  controller.signal,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.token}`,
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new AvecApiError(
          `Avec API ${res.status} ${res.statusText}: ${path}`,
          res.status,
          text
        );
      }

      return res.json() as Promise<T>;
    } finally {
      clearTimeout(timeout);
    }
  }

  // ── Customers (/reports/0004) ────────────────────────────
  // Returns all customers: email, phone, mobile, birthday

  async getCustomers(page = 1, limit = 250): Promise<AvecPage<AvecCustomer>> {
    return this.request("/reports/0004", { page, limit });
  }

  // ── Attended clients (/reports/0002) ────────────────────
  // Returns clients attended in period with visit count and consumption

  async getAttendedClients(
    inicio: Date,
    fim:    Date,
    page = 1,
    limit = 250
  ): Promise<AvecPage<AvecCustomer>> {
    return this.request("/reports/0002", {
      page,
      limit,
      inicio: format(inicio, "dd/MM/yyyy"),
      fim:    format(fim,    "dd/MM/yyyy"),
    });
  }

  // ── Appointments (/reports/0051) ────────────────────────
  // Returns clients with appointments in period (excludes cancelled)

  async getAppointments(
    inicio: Date,
    fim:    Date,
    page = 1,
    limit = 250
  ): Promise<AvecPage<AvecAppointment>> {
    return this.request("/reports/0051", {
      page,
      limit,
      inicio: format(inicio, "dd/MM/yyyy"),
      fim:    format(fim,    "dd/MM/yyyy"),
    });
  }

  // ── Services (/reports/0031) ─────────────────────────────
  // Returns services performed in period

  async getServices(
    inicio: Date,
    fim:    Date,
    page = 1,
    limit = 250
  ): Promise<AvecPage<AvecService>> {
    return this.request("/reports/0031", {
      page,
      limit,
      inicio: format(inicio, "dd/MM/yyyy"),
      fim:    format(fim,    "dd/MM/yyyy"),
    });
  }

  // ── Health check ─────────────────────────────────────────

  async ping(): Promise<boolean> {
    try {
      await this.getCustomers(1, 1);
      return true;
    } catch {
      return false;
    }
  }
}

// ── Error ────────────────────────────────────────────────────

export class AvecApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly body:       string
  ) {
    super(message);
    this.name = "AvecApiError";
  }
}

// ── Factory ──────────────────────────────────────────────────

export function buildAvecClient(configJson: string): AvecClient {
  const config = JSON.parse(configJson) as AvecConfig;
  return new AvecClient(config);
}
