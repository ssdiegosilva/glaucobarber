import { config } from "dotenv";
config();

import { PrismaClient } from "@prisma/client";

async function test(label: string, url: string) {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const count = await prisma.user.count();
    console.log(`✅ ${label}: OK — ${count} users`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`❌ ${label}: ${msg.split("\n")[0]}`);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  console.log("Testing DATABASE_URL (pooler)...");
  await test("DATABASE_URL", process.env.DATABASE_URL!);

  console.log("Testing DIRECT_URL (direct)...");
  await test("DIRECT_URL", process.env.DIRECT_URL!);
}

main();
