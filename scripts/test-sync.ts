import { config } from "dotenv";
config();

import { PrismaClient } from "@prisma/client";
import { buildTrinksClient } from "../src/lib/integrations/trinks/client";
import { mapTrinksCustomer, mapTrinksService, mapTrinksAppointment } from "../src/lib/integrations/trinks/mappers";
import { format, subDays, addDays } from "date-fns";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function main() {
  const shop = await prisma.barbershop.findFirst({ where: { slug: "artshave" } });
  if (!shop) throw new Error("Barbershop not found");
  console.log("Barbershop:", shop.name);

  const integration = await prisma.integration.findUnique({ where: { barbershopId: shop.id } });
  if (!integration?.configJson) throw new Error("No integration config");

  const client = buildTrinksClient(integration.configJson);

  // ── Test: fetch 1 page of customers ─────────────────────
  console.log("\n📋 Fetching customers (page 1)...");
  const custRes = await client.getCustomers(1, 20);
  console.log(`  Total customers: ${custRes.totalRecords}, pages: ${custRes.totalPages}`);
  console.log(`  Sample: ${custRes.data.slice(0, 3).map(c => c.nome).join(", ")}`);

  // Upsert first page
  let customersUpserted = 0;
  for (const raw of custRes.data) {
    await prisma.customer.upsert({
      where:  { barbershopId_trinksId: { barbershopId: shop.id, trinksId: String(raw.id) } },
      create: mapTrinksCustomer(raw, shop.id),
      update: { name: raw.nome, lastSyncedAt: new Date() },
    });
    customersUpserted++;
  }
  console.log(`  ✅ Upserted ${customersUpserted} customers`);

  // ── Test: fetch services ────────────────────────────────
  console.log("\n✂️  Fetching services...");
  const svcRes = await client.getServices();
  console.log(`  Total services: ${svcRes.totalRecords}`);
  console.log(`  Sample: ${svcRes.data.slice(0, 5).map(s => `${s.nome} R$${s.preco}`).join(", ")}`);

  let servicesUpserted = 0;
  for (const raw of svcRes.data) {
    await prisma.service.upsert({
      where:  { barbershopId_trinksId: { barbershopId: shop.id, trinksId: String(raw.id) } },
      create: mapTrinksService(raw, shop.id),
      update: { name: raw.nome, price: raw.preco, durationMin: raw.duracao, lastSyncedAt: new Date() },
    });
    servicesUpserted++;
  }
  console.log(`  ✅ Upserted ${servicesUpserted} services`);

  // ── Test: fetch today's appointments ───────────────────
  console.log("\n📅 Fetching today's appointments...");
  const todayApts = await client.getTodayAppointments();
  console.log(`  Today: ${todayApts.totalRecords} appointments`);

  // Build maps
  const [customers, services] = await Promise.all([
    prisma.customer.findMany({ where: { barbershopId: shop.id, trinksId: { not: null } }, select: { id: true, trinksId: true } }),
    prisma.service.findMany({  where: { barbershopId: shop.id, trinksId: { not: null } }, select: { id: true, trinksId: true } }),
  ]);
  const customerMap = new Map(customers.map(c => [c.trinksId!, c.id]));
  const serviceMap  = new Map(services.map(s  => [s.trinksId!, s.id]));

  let aptsUpserted = 0;
  for (const raw of todayApts.data) {
    await prisma.appointment.upsert({
      where:  { barbershopId_trinksId: { barbershopId: shop.id, trinksId: String(raw.id) } },
      create: mapTrinksAppointment(raw, shop.id, customerMap, serviceMap),
      update: { status: mapTrinksAppointment(raw, shop.id, customerMap, serviceMap).status, price: raw.valor, lastSyncedAt: new Date() },
    });
    aptsUpserted++;
  }
  console.log(`  ✅ Upserted ${aptsUpserted} appointments`);

  // Show today's schedule
  console.log("\n📊 Today's schedule:");
  todayApts.data.forEach(a => {
    const time = new Date(a.dataHoraInicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    console.log(`  ${time} – ${a.cliente?.nome ?? "?"} – ${a.servico?.nome ?? "?"} – R$${a.valor} – ${a.status?.nome}`);
  });

  console.log("\n🎉 Quick sync done!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
