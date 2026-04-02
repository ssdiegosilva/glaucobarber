// ============================================================
// AI Provider – Type Contracts
// ============================================================

export interface AISuggestionRequest {
  barbershopName: string;
  date:           string; // dd/MM/yyyy
  dayOfWeek:      string;
  totalSlots:     number;
  bookedSlots:    number;
  freeSlots:      number;
  occupancyRate:  number; // 0-1
  revenueToday:   number; // BRL
  revenueGoal?:   number;
  topServices:    string[];
  // Post-sale breakdown (replaces old generic inactiveClients)
  clientsAtRisk:        number; // EM_RISCO: 14–60 dias sem visita, sem agendamento
  clientsInactive:      number; // INATIVO: >60 dias sem visita
  clientsReactivated:   number; // REATIVADO: voltaram nos últimos 60 dias
  pendingGoogleReviews: number; // avaliações Google a solicitar (48h pós-atendimento)
  recentCampaigns: string[];    // campanhas ativas/aprovadas
  goals?:          string;
}

export interface AISuggestion {
  type:    "COMMERCIAL_INSIGHT" | "CAMPAIGN_TEXT" | "CLIENT_MESSAGE" | "SOCIAL_POST" | "PROMO_BRIEFING" | "OFFER_OPPORTUNITY";
  title:   string;
  content: string;
  reason:  string;
}

export interface AIProvider {
  name: string;
  generateSuggestions(context: AISuggestionRequest): Promise<AISuggestion[]>;
  generateCampaignText(objective: string, context: string): Promise<{ text: string; artBriefing: string }>;
  generateCampaignImage(input: {
    prompt: string;
    styleHint?: string;
  }): Promise<{ url: string }>;
  generateClientMessage(clientName: string, daysSinceVisit: number, services: string[]): Promise<string>;
  generateCopilotResponse(context: CopilotContext, question: string): Promise<CopilotResponse>;
}

// ── Copilot types ─────────────────────────────────────────

export interface CopilotContext {
  barbershopName: string;
  date: string;
  dayOfWeek: string;
  occupancyRate: number;
  totalSlots: number;
  bookedSlots: number;
  freeSlots: number;
  freeWindows: string[];
  projectedRevenue: number;
  completedRevenue: number;
  revenueGoal?: number | null;
  topServices: string[];
  // Post-sale (replaces old generic inactiveClients)
  clientsAtRisk:        number;
  clientsInactive:      number;
  clientsReactivated:   number;
  pendingGoogleReviews: number;
  // Campaigns
  activeCampaigns:     string[];
  publishedCampaigns:  { title: string; permalink?: string | null }[];
  weekGoal?: number | null;
  weekProgress?: number | null; // 0-1

  // ── Monthly financial goal tracking ──────────────────────
  /** Whether a revenue goal was defined for the current month */
  monthGoalSet:           boolean;
  /** Receita realizada (COMPLETED) neste mês */
  monthRevenueActual:     number;
  /** Meta de receita do mês (null = não definida) */
  monthRevenueTarget:     number | null;
  /** Progresso 0-1 da meta de receita (null se sem meta) */
  monthRevenuePct:        number | null;
  /** Meta de atendimentos do mês */
  monthApptTarget:        number | null;
  /** Atendimentos concluídos neste mês */
  monthApptActual:        number;
  /** Dias restantes no mês (incluindo hoje) */
  daysLeftInMonth:        number;
  /** Receita diária necessária para bater a meta (null se sem meta ou já atingida) */
  dailyRevenueNeeded:     number | null;

  // ── Reactivation opportunities ───────────────────────────
  /** Top inactive clients ready for a promo — sorted by days inactive desc */
  topInactiveForPromo: {
    name:        string;
    phone?:      string | null;
    daysSince:   number;
    lastService: string | null;
  }[];

  // Overlapping appointments detected today
  overlaps: {
    professionalName:   string | null;
    clientA:            { name: string; phone?: string | null };
    clientB:            { name: string; phone?: string | null };
    startA:             string;
    startB:             string;
    alternativeHint:    string | null;
  }[];
}

export interface CopilotActionSuggestion {
  title: string;
  description?: string;
  type: string;
  reason?: string;
  payload?: Record<string, unknown>;
}

export interface CopilotResponse {
  answer: string;
  actions: CopilotActionSuggestion[];
  requireApproval: boolean;
}
