// ============================================================
// seed-admin.ts — Grants PLATFORM_ADMIN role to ss.diegosilva@gmail.com
// Run once: npx tsx scripts/seed-admin.ts
// ============================================================
import { config } from "dotenv";
config();

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } },
});

const ADMIN_EMAIL = "ss.diegosilva@gmail.com";

async function main() {
  console.log(`Looking up user: ${ADMIN_EMAIL}`);

  const user = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!user) {
    console.error(`❌ User not found. Make sure ${ADMIN_EMAIL} has logged in at least once.`);
    process.exit(1);
  }

  console.log(`✅ Found user: ${user.id}`);

  // Find or create a "platform admin" barbershop to satisfy the FK constraint
  let adminShop = await prisma.barbershop.findFirst({
    where: { slug: "__platform_admin__" },
  });

  if (!adminShop) {
    adminShop = await prisma.barbershop.create({
      data: {
        name:  "Platform Admin",
        slug:  "__platform_admin__",
        email: ADMIN_EMAIL,
      },
    });
    console.log(`✅ Created platform admin barbershop: ${adminShop.id}`);
  }

  // Upsert PLATFORM_ADMIN membership
  const membership = await prisma.membership.upsert({
    where:  { userId_barbershopId: { userId: user.id, barbershopId: adminShop.id } },
    update: { role: "PLATFORM_ADMIN", active: true },
    create: { userId: user.id, barbershopId: adminShop.id, role: "PLATFORM_ADMIN", active: true },
  });

  console.log(`✅ PLATFORM_ADMIN membership upserted: ${membership.id}`);
  console.log(`\n🎉 Done! ${ADMIN_EMAIL} is now a platform admin.`);
  console.log(`   Access the admin panel at: https://glaucobarber.com/admin`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
