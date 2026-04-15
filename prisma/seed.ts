// ============================================================
// GlaucoBarber – Database Seed
// Run: npm run db:seed
// ============================================================

import { PrismaClient, MembershipRole, ServiceCategory, AppointmentStatus, SuggestionType, SuggestionStatus, CampaignStatus, IntegrationStatus } from "@prisma/client";
import { addDays, addHours, subDays, startOfDay } from "date-fns";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding GlaucoBarber database...");

  // ── Clean up ──────────────────────────────────────────────
  await prisma.auditLog.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.suggestion.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.service.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.syncRun.deleteMany();
  await prisma.integration.deleteMany();
  await prisma.featureFlag.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.platformSubscription.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.barbershop.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  // ── Users ─────────────────────────────────────────────────
  const platformAdmin = await prisma.user.create({
    data: {
      name: "Diego (Platform Admin)",
      email: "admin@glaucobarber.com",
      emailVerified: new Date(),
    },
  });

  const ownerUser = await prisma.user.create({
    data: {
      name: "Glauco Silva",
      email: "glauco@artshave.com.br",
      emailVerified: new Date(),
    },
  });

  const barberUser = await prisma.user.create({
    data: {
      name: "Rafael Costa",
      email: "rafael@artshave.com.br",
      emailVerified: new Date(),
    },
  });

  console.log("✅ Users created");

  // ── Barbershop ────────────────────────────────────────────
  const barbershop = await prisma.barbershop.create({
    data: {
      slug: "artshave",
      name: "Barbearia Art Shave",
      phone: "+55 11 99999-0000",
      email: "contato@artshave.com.br",
      address: "Rua das Flores, 123",
      city: "São Paulo",
      state: "SP",
      websiteUrl: "https://barbeariaartshave.com.br",
      trinksConfigured: true,
    },
  });

  // Memberships
  await prisma.membership.createMany({
    data: [
      { userId: platformAdmin.id, barbershopId: barbershop.id, role: MembershipRole.PLATFORM_ADMIN },
      { userId: ownerUser.id,     barbershopId: barbershop.id, role: MembershipRole.OWNER },
      { userId: barberUser.id,    barbershopId: barbershop.id, role: MembershipRole.BARBER },
    ],
  });

  console.log("✅ Barbershop + memberships created");

  // ── Feature flags ─────────────────────────────────────────
  await prisma.featureFlag.createMany({
    data: [
      { barbershopId: barbershop.id, flag: "ai_suggestions",     enabled: true },
      { barbershopId: barbershop.id, flag: "campaigns",          enabled: true },
    ],
  });

  // ── Integration (Trinks) ──────────────────────────────────
  const integration = await prisma.integration.create({
    data: {
      barbershopId: barbershop.id,
      provider: "trinks",
      status: IntegrationStatus.ACTIVE,
      configJson: JSON.stringify({
        // NOTE: These are placeholder values.
        // Real Trinks API credentials must be entered via the UI.
        // See lib/integrations/trinks/types.ts for the full contract.
        apiKey: "DEMO_KEY_REPLACE_ME",
        companyId: "DEMO_COMPANY_ID",
      }),
      lastSyncAt: subDays(new Date(), 1),
    },
  });

  await prisma.syncRun.create({
    data: {
      barbershopId: barbershop.id,
      integrationId: integration.id,
      status: "SUCCESS",
      triggeredBy: "seed",
      customersUpserted: 10,
      servicesUpserted: 5,
      appointmentsUpserted: 20,
      startedAt: subDays(new Date(), 1),
      finishedAt: subDays(new Date(), 1),
      durationMs: 1843,
    },
  });

  console.log("✅ Integration + sync run created");

  // ── Services ──────────────────────────────────────────────
  const services = await Promise.all([
    prisma.service.create({ data: { barbershopId: barbershop.id, trinksId: "trinks-svc-001", name: "Corte Clássico",      category: ServiceCategory.HAIRCUT, price: 45.00, durationMin: 30, syncedFromTrinks: true } }),
    prisma.service.create({ data: { barbershopId: barbershop.id, trinksId: "trinks-svc-002", name: "Corte + Barba",       category: ServiceCategory.COMBO,   price: 75.00, durationMin: 50, syncedFromTrinks: true } }),
    prisma.service.create({ data: { barbershopId: barbershop.id, trinksId: "trinks-svc-003", name: "Barba Completa",      category: ServiceCategory.BEARD,   price: 40.00, durationMin: 30, syncedFromTrinks: true } }),
    prisma.service.create({ data: { barbershopId: barbershop.id, trinksId: "trinks-svc-004", name: "Degradê Americano",   category: ServiceCategory.HAIRCUT, price: 55.00, durationMin: 40, syncedFromTrinks: true } }),
    prisma.service.create({ data: { barbershopId: barbershop.id, trinksId: "trinks-svc-005", name: "Tratamento Capilar",  category: ServiceCategory.TREATMENT,price: 90.00, durationMin: 60, syncedFromTrinks: true } }),
  ]);

  console.log("✅ Services created");

  // ── Customers ─────────────────────────────────────────────
  const customers = await prisma.customer.createManyAndReturn({
    data: [
      { barbershopId: barbershop.id, trinksId: "trinks-cli-001", name: "Lucas Ferreira",  phone: "11991110001", email: "lucas@email.com",  status: "ACTIVE", totalVisits: 12, totalSpent: 660,  lastVisitAt: subDays(new Date(), 5),  syncedFromTrinks: true },
      { barbershopId: barbershop.id, trinksId: "trinks-cli-002", name: "Marcos Oliveira", phone: "11991110002", email: "marcos@email.com", status: "VIP",    totalVisits: 28, totalSpent: 1960, lastVisitAt: subDays(new Date(), 2),  syncedFromTrinks: true },
      { barbershopId: barbershop.id, trinksId: "trinks-cli-003", name: "Gabriel Santos",  phone: "11991110003", email: null,               status: "INACTIVE",totalVisits: 3,  totalSpent: 135,  lastVisitAt: subDays(new Date(), 45), syncedFromTrinks: true },
      { barbershopId: barbershop.id, trinksId: "trinks-cli-004", name: "Pedro Almeida",   phone: "11991110004", email: "pedro@email.com",  status: "ACTIVE", totalVisits: 8,  totalSpent: 480,  lastVisitAt: subDays(new Date(), 10), syncedFromTrinks: true },
      { barbershopId: barbershop.id, trinksId: "trinks-cli-005", name: "Felipe Rocha",    phone: "11991110005", email: null,               status: "INACTIVE",totalVisits: 2,  totalSpent: 90,   lastVisitAt: subDays(new Date(), 60), syncedFromTrinks: true },
      { barbershopId: barbershop.id, trinksId: "trinks-cli-006", name: "André Lima",      phone: "11991110006", email: "andre@email.com",  status: "ACTIVE", totalVisits: 15, totalSpent: 825,  lastVisitAt: subDays(new Date(), 8),  syncedFromTrinks: true },
      { barbershopId: barbershop.id, trinksId: "trinks-cli-007", name: "Bruno Mendes",    phone: "11991110007", email: null,               status: "VIP",    totalVisits: 32, totalSpent: 2400, lastVisitAt: subDays(new Date(), 3),  syncedFromTrinks: true },
      { barbershopId: barbershop.id, trinksId: "trinks-cli-008", name: "Thiago Cardoso",  phone: "11991110008", email: "thiago@email.com", status: "ACTIVE", totalVisits: 6,  totalSpent: 330,  lastVisitAt: subDays(new Date(), 15), syncedFromTrinks: true },
    ],
  });

  console.log("✅ Customers created");

  // ── Appointments (today's schedule) ───────────────────────
  const today = startOfDay(new Date());
  await prisma.appointment.createMany({
    data: [
      { barbershopId: barbershop.id, trinksId: "trinks-apt-001", customerId: customers[0].id, serviceId: services[0].id, scheduledAt: addHours(today, 9),    status: AppointmentStatus.COMPLETED, price: 45.00, syncedFromTrinks: true },
      { barbershopId: barbershop.id, trinksId: "trinks-apt-002", customerId: customers[1].id, serviceId: services[1].id, scheduledAt: addHours(today, 10),   status: AppointmentStatus.COMPLETED, price: 75.00, syncedFromTrinks: true },
      { barbershopId: barbershop.id, trinksId: "trinks-apt-003", customerId: customers[3].id, serviceId: services[2].id, scheduledAt: addHours(today, 11),   status: AppointmentStatus.IN_PROGRESS, price: 40.00, syncedFromTrinks: true },
      { barbershopId: barbershop.id, trinksId: "trinks-apt-004", customerId: customers[5].id, serviceId: services[3].id, scheduledAt: addHours(today, 13),   status: AppointmentStatus.SCHEDULED, price: 55.00, syncedFromTrinks: true },
      { barbershopId: barbershop.id, trinksId: "trinks-apt-005", customerId: customers[6].id, serviceId: services[1].id, scheduledAt: addHours(today, 14),   status: AppointmentStatus.SCHEDULED, price: 75.00, syncedFromTrinks: true },
      { barbershopId: barbershop.id, trinksId: "trinks-apt-006", customerId: customers[2].id, serviceId: services[0].id, scheduledAt: addHours(today, 15.5), status: AppointmentStatus.SCHEDULED, price: 45.00, syncedFromTrinks: true },
      { barbershopId: barbershop.id, trinksId: "trinks-apt-007", customerId: customers[7].id, serviceId: services[4].id, scheduledAt: addHours(today, 17),   status: AppointmentStatus.SCHEDULED, price: 90.00, syncedFromTrinks: true },
    ],
  });

  console.log("✅ Appointments created");

  // ── AI Suggestions ────────────────────────────────────────
  await prisma.suggestion.createMany({
    data: [
      {
        barbershopId: barbershop.id,
        type: SuggestionType.COMMERCIAL_INSIGHT,
        status: SuggestionStatus.PENDING,
        title: "Agenda com 2 buracos esta tarde",
        content: "Você tem horários vagos às 12h e 16h30. Boa oportunidade para contatar clientes inativos ou oferecer um combo relâmpago.",
        reason: "Taxa de ocupação da tarde está em 60%. Média dos últimos 30 dias é 82%.",
        context: JSON.stringify({ date: new Date().toISOString(), occupancy: 0.6, freeSlots: ["12:00", "16:30"] }),
      },
      {
        barbershopId: barbershop.id,
        type: SuggestionType.CLIENT_MESSAGE,
        status: SuggestionStatus.PENDING,
        title: "3 clientes sem aparecer há mais de 30 dias",
        content: "Oi [Nome], tudo bem? Faz um tempinho que não te vemos por aqui na Art Shave. Que tal agendar um corte essa semana? Ainda temos horário disponível 🔥",
        reason: "Gabriel Santos (45 dias), Felipe Rocha (60 dias) e mais 1 cliente estão inativos há mais de 30 dias.",
        context: JSON.stringify({ inactiveClients: 3, avgDaysInactive: 52 }),
      },
      {
        barbershopId: barbershop.id,
        type: SuggestionType.SOCIAL_POST,
        status: SuggestionStatus.PENDING,
        title: "Post para o Instagram: terça à tarde",
        content: "Corte novo, semana nova. 💈 Ainda temos horários disponíveis essa tarde na Art Shave. Vem renovar o visual — sem fila, sem espera. Link na bio para agendar.",
        reason: "Ocupação baixa na tarde desta terça. Post pode gerar agendamentos de última hora.",
        context: JSON.stringify({ freeSlots: 2, dayOfWeek: "tuesday", time: "afternoon" }),
      },
    ],
  });

  // ── Campaign (from approved suggestion) ──────────────────
  await prisma.campaign.create({
    data: {
      barbershopId: barbershop.id,
      status: CampaignStatus.APPROVED,
      title: "Campanha: Pacote de Verão",
      objective: "Vender pacotes antecipados para garantir receita recorrente",
      text: "🔥 Aproveite o verão com o cabelo sempre em dia! Compre agora nosso Pacote 5 Cortes com 20% de desconto. Válido por 90 dias. Garanta o seu — vagas limitadas!",
      artBriefing: "Imagem de fundo escura/dourada. Logo Art Shave em destaque. Texto em branco bold. Ícone de tesoura ou navalha. CTA: 'Garantir Pacote'.",
      channel: "instagram",
    },
  });

  // ── Goal ──────────────────────────────────────────────────
  const now = new Date();
  await prisma.goal.create({
    data: {
      barbershopId: barbershop.id,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      revenueTarget: 8000.00,
      appointmentTarget: 120,
    },
  });

  console.log("✅ Suggestions, campaign, goal created");
  console.log("");
  console.log("🎉 Seed completo!");
  console.log("");
  console.log("  Admin:  admin@glaucobarber.com");
  console.log("  Owner:  glauco@artshave.com.br");
  console.log("  Barber: rafael@artshave.com.br");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
