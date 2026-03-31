// ============================================================
// AI Provider – Type Contracts
// ============================================================

export interface AISuggestionRequest {
  barbershopName: string;
  date:           string; // ISO date
  dayOfWeek:      string;
  totalSlots:     number;
  bookedSlots:    number;
  freeSlots:      number;
  occupancyRate:  number; // 0-1
  revenueToday:   number; // BRL
  revenueGoal?:   number;
  topServices:    string[];
  inactiveClients: number;
  recentCampaigns: string[];
  goals?:         string;
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
  generateClientMessage(clientName: string, daysSinceVisit: number, services: string[]): Promise<string>;
}
