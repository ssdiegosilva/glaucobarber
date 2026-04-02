import { prisma } from "@/lib/prisma";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export interface AuthSession {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    barbershopId: string | null;
    barbershopSlug: string | null;
    role: string | null;
    isAdmin: boolean;
  };
}

export async function auth(): Promise<AuthSession | null> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;

  const dbUser = await prisma.user.upsert({
    where: { email: user.email },
    update: {
      name: user.user_metadata?.full_name ?? undefined,
      emailVerified: user.email_confirmed_at ? new Date(user.email_confirmed_at) : undefined,
    },
    create: {
      email: user.email,
      name: user.user_metadata?.full_name ?? null,
      emailVerified: user.email_confirmed_at ? new Date(user.email_confirmed_at) : null,
    },
  });

  const memberships = await prisma.membership.findMany({
    where: { userId: dbUser.id, active: true },
    include: { barbershop: true },
    orderBy: { createdAt: "asc" },
  });

  // PLATFORM_ADMIN takes priority for role/isAdmin, but barbershop comes from OWNER membership
  const adminMembership = memberships.find((m) => m.role === "PLATFORM_ADMIN") ?? null;
  const shopMembership = memberships.find((m) => m.role !== "PLATFORM_ADMIN") ?? null;
  const membership = adminMembership ?? shopMembership;

  const isAdmin = !!adminMembership;

  return {
    user: {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      barbershopId: shopMembership?.barbershopId ?? null,
      barbershopSlug: shopMembership?.barbershop?.slug ?? null,
      role: membership?.role ?? null,
      isAdmin,
    },
  };
}
