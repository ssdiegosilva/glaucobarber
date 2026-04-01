import { config } from "dotenv";
config();

import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } },
});

async function main() {
  const email    = "glauco@artshave.com.br";
  const password = "demo1234";

  console.log(`Creating Supabase Auth user: ${email}`);

  // Check if user already exists
  const { data: existing } = await supabase.auth.admin.listUsers();
  const alreadyExists = existing?.users?.find(u => u.email === email);

  if (alreadyExists) {
    console.log("User already exists in Supabase Auth, updating password...");
    const { error } = await supabase.auth.admin.updateUserById(alreadyExists.id, { password });
    if (error) throw error;
    console.log("✅ Password updated");
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Glauco" },
    });
    if (error) throw error;
    console.log(`✅ Supabase Auth user created: ${data.user.id}`);
  }

  // Verify DB user exists
  const dbUser = await prisma.user.findUnique({ where: { email } });
  if (dbUser) {
    console.log(`✅ DB user exists: ${dbUser.id}`);
  } else {
    console.log("⚠️  DB user not found — run seed first");
  }

  console.log(`\n✅ Done! Login with:\n  Email: ${email}\n  Password: ${password}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
