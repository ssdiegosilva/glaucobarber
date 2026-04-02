import { prisma } from "@/lib/prisma";
import { STATUS_WINDOWS, computePostSaleStatus } from "./status-utils";
import type { PostSaleStatus, PostSaleActionType, PostSaleChannel, PostSaleResult, ReviewRequestStatus } from "./types";

// Helpers --------------------------------------------------

function daysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

// Refreshes the rolling 60-day cached stats for a single customer
export async function refreshCustomer60dStats(customerId: string) {
  const since60 = daysAgo(60);

  const agg = await prisma.appointment.aggregate({
    where: { customerId, status: "COMPLETED", scheduledAt: { gte: since60 } },
    _count: { _all: true },
    _sum:   { price: true },
  });

  const visits = agg._count._all;
  const total  = Number(agg._sum.price ?? 0);
  const avg    = visits > 0 ? total / visits : 0;

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      visitsLast60d:     visits,
      totalSpentLast60d: total,
      avgTicketLast60d:  avg,
    },
  });
}

// Status refresh used by cron or on-demand
export async function refreshPostSaleStatus(barbershopId: string) {
  const now = new Date();
  const customers = await prisma.customer.findMany({
    where: { barbershopId },
    select: {
      id: true,
      doNotContact: true,
      lastCompletedAppointmentAt: true,
      nextAppointmentAt: true,
      inactiveAt: true,
      reactivatedAt: true,
      postSaleStatus: true,
    },
  });

  const updates: { id: string; postSaleStatus: PostSaleStatus | null; inactiveAt?: Date | null; reactivatedAt?: Date | null }[] = [];

  customers.forEach((c) => {
    const status = computePostSaleStatus({
      lastCompletedAt: c.lastCompletedAppointmentAt,
      nextAppointmentAt: c.nextAppointmentAt,
      inactiveAt: c.inactiveAt,
      reactivatedAt: c.reactivatedAt,
      doNotContact: c.doNotContact,
    });

    if (status !== c.postSaleStatus) {
      updates.push({
        id: c.id,
        postSaleStatus: status,
        inactiveAt: status === "INATIVO" ? now : c.inactiveAt,
        reactivatedAt: status === "REATIVADO" ? now : c.reactivatedAt,
      });
    }
  });

  await Promise.all(
    updates.map((u) =>
      prisma.customer.update({
        where: { id: u.id },
        data: {
          postSaleStatus: u.postSaleStatus ?? null,
          inactiveAt: u.inactiveAt,
          reactivatedAt: u.reactivatedAt,
        },
      })
    )
  );

  return { updated: updates.length };
}

// Queries per tab -----------------------------------------

const BASE_CUSTOMER_SELECT = {
  id: true,
  name: true,
  phone: true,
  lastCompletedAppointmentAt: true,
  nextAppointmentAt: true,
  postSaleStatus: true,
  churnReason: true,
  doNotContact: true,
  reactivatedAt: true,
  totalVisits: true,
  totalSpent: true,
  appointments: {
    select: {
      id: true,
      completedAt: true,
      scheduledAt: true,
      status: true,
      service: { select: { name: true } },
      barberId: true,
    },
    orderBy: { completedAt: "desc" as const },
    take: 1,
  },
};

export async function listAtRisk(barbershopId: string, page = 1, pageSize = 20) {
  const cutoff = daysAgo(STATUS_WINDOWS.inactive); // 60 days
  const riskStart = daysAgo(STATUS_WINDOWS.risk + 1); // >14 days

  const [items, total] = await prisma.$transaction([
    prisma.customer.findMany({
      where: {
        barbershopId,
        postSaleStatus: "EM_RISCO",
        doNotContact: false,
        lastCompletedAppointmentAt: { gt: cutoff },
        OR: [{ nextAppointmentAt: null }, { nextAppointmentAt: { lte: new Date() } }],
      },
      orderBy: { lastCompletedAppointmentAt: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: BASE_CUSTOMER_SELECT,
    }),
    prisma.customer.count({
      where: {
        barbershopId,
        postSaleStatus: "EM_RISCO",
        doNotContact: false,
        lastCompletedAppointmentAt: { gt: cutoff },
        OR: [{ nextAppointmentAt: null }, { nextAppointmentAt: { lte: new Date() } }],
      },
    }),
  ]);

  return { items, total, page, pageSize };
}

export async function listGoogleReviews(barbershopId: string, page = 1, pageSize = 20) {
  const cutoff = daysAgo(2); // 48h window for reviews request
  const since = daysAgo(2);

  const [items, total] = await prisma.$transaction([
    prisma.customerReview.findMany({
      where: {
        barbershopId,
        requestStatus: "pendente",
        appointment: { completedAt: { gte: since } },
        customer: { reviewOptOut: false },
      },
      orderBy: { appointment: { completedAt: "desc" } },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        requestStatus: true,
        customerId: true,
        appointmentId: true,
        appointment: { select: { completedAt: true, service: { select: { name: true } } } },
        customer: { select: { name: true, phone: true } },
      },
    }),
    prisma.customerReview.count({
      where: {
        barbershopId,
        requestStatus: "pendente",
        appointment: { completedAt: { gte: since } },
        customer: { reviewOptOut: false },
      },
    }),
  ]);

  return { items, total, page, pageSize };
}

export async function listRecent(barbershopId: string, page = 1, pageSize = 20) {
  const since = daysAgo(2);

  const [items, total] = await prisma.$transaction([
    prisma.customer.findMany({
      where: {
        barbershopId,
        lastCompletedAppointmentAt: { gte: since },
      },
      orderBy: { lastCompletedAppointmentAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: BASE_CUSTOMER_SELECT,
    }),
    prisma.customer.count({
      where: {
        barbershopId,
        lastCompletedAppointmentAt: { gte: since },
      },
    }),
  ]);

  return { items, total, page, pageSize };
}

export async function listInactive(barbershopId: string, page = 1, pageSize = 20) {
  const cutoff = daysAgo(STATUS_WINDOWS.inactive + 1);
  const [items, total] = await prisma.$transaction([
    prisma.customer.findMany({
      where: {
        barbershopId,
        postSaleStatus: "INATIVO",
        lastCompletedAppointmentAt: { lt: cutoff },
      },
      orderBy: { lastCompletedAppointmentAt: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: BASE_CUSTOMER_SELECT,
    }),
    prisma.customer.count({
      where: {
        barbershopId,
        postSaleStatus: "INATIVO",
        lastCompletedAppointmentAt: { lt: cutoff },
      },
    }),
  ]);

  return { items, total, page, pageSize };
}

export async function listReactivated(barbershopId: string, page = 1, pageSize = 20) {
  const since = daysAgo(STATUS_WINDOWS.inactive);
  const [items, total] = await prisma.$transaction([
    prisma.customer.findMany({
      where: {
        barbershopId,
        postSaleStatus: "REATIVADO",
        reactivatedAt: { gte: since },
      },
      orderBy: { reactivatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: BASE_CUSTOMER_SELECT,
    }),
    prisma.customer.count({
      where: {
        barbershopId,
        postSaleStatus: "REATIVADO",
        reactivatedAt: { gte: since },
      },
    }),
  ]);

  return { items, total, page, pageSize };
}

export async function listFollowUps(barbershopId: string, customerId: string, page = 1, pageSize = 20) {
  const [items, total] = await prisma.$transaction([
    prisma.postSaleAction.findMany({
      where: { barbershopId, customerId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.postSaleAction.count({ where: { barbershopId, customerId } }),
  ]);

  return { items, total, page, pageSize };
}

export async function createFollowUp(params: {
  barbershopId: string;
  customerId: string;
  appointmentId?: string | null;
  actionType: PostSaleActionType;
  channel: PostSaleChannel;
  result: PostSaleResult;
  notes?: string;
  userId?: string | null;
}) {
  return prisma.postSaleAction.create({
    data: {
      barbershopId: params.barbershopId,
      customerId: params.customerId,
      appointmentId: params.appointmentId ?? null,
      actionType: params.actionType,
      channel: params.channel,
      result: params.result,
      notes: params.notes,
      createdByUserId: params.userId ?? null,
    },
  });
}

export async function upsertReviewRequest(params: {
  barbershopId: string;
  customerId: string;
  appointmentId: string;
  status: ReviewRequestStatus;
  reviewUrl?: string | null;
}) {
  return prisma.customerReview.upsert({
    where: { appointmentId: params.appointmentId },
    update: { requestStatus: params.status, reviewUrl: params.reviewUrl ?? null, requestSentAt: params.status === "enviado" ? new Date() : undefined },
    create: {
      barbershopId: params.barbershopId,
      customerId: params.customerId,
      appointmentId: params.appointmentId,
      requestStatus: params.status,
      requestSentAt: params.status === "enviado" ? new Date() : null,
    },
  });
}

// Dashboard counters --------------------------------------
export async function getPostSaleSummary(barbershopId: string) {
  const since60 = daysAgo(STATUS_WINDOWS.inactive);
  const since48h = daysAgo(2);
  const since36h = daysAgo(2); // reuse 48h range

  const [emRisco, inativos, recentes, reativados, avalPendentes] = await prisma.$transaction([
    prisma.customer.count({ where: { barbershopId, postSaleStatus: "EM_RISCO" } }),
    prisma.customer.count({ where: { barbershopId, postSaleStatus: "INATIVO" } }),
    prisma.customer.count({ where: { barbershopId, postSaleStatus: "RECENTE", lastCompletedAppointmentAt: { gte: since48h } } }),
    prisma.customer.count({ where: { barbershopId, postSaleStatus: "REATIVADO", reactivatedAt: { gte: since60 } } }),
    prisma.customerReview.count({
      where: {
        barbershopId,
        requestStatus: "pendente",
        appointment: { completedAt: { gte: since36h } },
      },
    }),
  ]);

  return {
    emRisco,
    inativos,
    recentes,
    reativados,
    avalPendentes,
  };
}
