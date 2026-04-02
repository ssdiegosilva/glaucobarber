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

  const membership = await prisma.membership.findFirst({
    where: { userId: dbUser.id, active: true },
    include: { barbershop: true },
    orderBy: { createdAt: "asc" },
  });

  const isAdmin = membership?.role === "PLATFORM_ADMIN";

  return {
    user: {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      barbershopId: isAdmin ? null : (membership?.barbershopId ?? null),
      barbershopSlug: isAdmin ? null : (membership?.barbershop?.slug ?? null),
      role: membership?.role ?? null,
      isAdmin,
    },
  };
}
