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
