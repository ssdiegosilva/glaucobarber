export type PostSaleStatus = "RECENTE" | "EM_RISCO" | "INATIVO" | "REATIVADO" | "NAO_CONTATAR";

export type PostSaleActionType =
  | "message_sent"
  | "call_made"
  | "review_request_sent"
  | "customer_replied"
  | "customer_no_response"
  | "customer_wants_return"
  | "rescheduled"
  | "reativated"
  | "no_interest";

export type PostSaleChannel = "whatsapp" | "phone" | "in_person" | "instagram" | "other";

export type PostSaleResult = "pending" | "completed" | "no_response" | "rescheduled" | "not_interested";

export type ReviewRequestStatus = "pendente" | "enviado" | "respondeu" | "avaliou" | "nao_solicitar";

export interface CustomerSummary {
  id: string;
  name: string;
  phone?: string | null;
  lastVisitAt?: string | null;
  nextAppointmentAt?: string | null;
  daysSinceLastVisit?: number;
  postSaleStatus: PostSaleStatus;
  professionalName?: string | null;
  serviceName?: string | null;
  servicePrice?: number | null;
  ticketMedio?: number;
  frequencia?: number;
  churnReason?: string | null;
  lastAction?: string | null;
  lastWhatsappSentAt?: string | null;
  lastCompletedAppointmentAt?: string | null;
  // FUP tracking per latest appointment
  lastAppointmentId?: string | null;
  reviewStatus?: string | null;   // null = not requested, 'enviado'/'respondeu'/'avaliou' = done
  sentTypes?: string[];            // WhatsApp message types sent since last appointment
  // Recent completed appointments for custom filter matching
  recentAppointments?: { serviceId: string | null; serviceName: string | null; completedAt: string }[];
  // Recent product purchases for product-based filter matching
  recentProductPurchases?: { productId: string | null; productName: string | null; purchasedAt: string }[];
}

export type CustomServiceFilter = {
  id: string;
  type: "service";
  serviceId: string;
  serviceName: string;
  followUpDays: number;
  enabled: boolean;
};

export type CustomProductFilter = {
  id: string;
  type: "product";
  productId: string;
  productName: string;
  followUpDays: number;
  enabled: boolean;
};

export type CustomFilter = CustomServiceFilter | CustomProductFilter;

export interface PostSaleFilterConfig {
  defaults: Record<"emRisco" | "recentes" | "inativos" | "reativados", boolean>;
  custom: CustomFilter[];
  visible: string[];
}

export interface PostSaleActionDto {
  id: string;
  customerId: string;
  appointmentId?: string | null;
  actionType: PostSaleActionType;
  channel: PostSaleChannel;
  result: PostSaleResult;
  notes?: string | null;
  createdAt: string;
  createdByUserId?: string | null;
}

export interface CustomerReviewDto {
  id: string;
  customerId: string;
  appointmentId: string;
  requestStatus: ReviewRequestStatus;
  requestSentAt?: string | null;
  respondedAt?: string | null;
  reviewedAt?: string | null;
  reviewUrl?: string | null;
}
