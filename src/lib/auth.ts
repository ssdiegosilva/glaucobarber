import { prisma } from "@/lib/prisma";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export const ACTIVE_BARBERSHOP_COOKIE = "activeBarbershopId";

export interface AuthSession {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    barbershopId: string | null;
    barbershopSlug: string | null;
    role: string | null;
    isAdmin: boolean;
    memberships: { barbershopId: string; barbershopName: string; role: string }[];
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
    include: { barbershop: { select: { name: true, slug: true } } },
    orderBy: { createdAt: "asc" },
  });

  const adminMembership = memberships.find((m) => m.role === "PLATFORM_ADMIN") ?? null;
  const shopMemberships = memberships.filter((m) => m.role !== "PLATFORM_ADMIN");

  // Read cookie to determine which barbershop is active
  const cookieStore = await cookies();
  const preferredId = cookieStore.get(ACTIVE_BARBERSHOP_COOKIE)?.value;

  // Use preferred barbershop if user has a valid membership for it, otherwise first
  const shopMembership = (preferredId
    ? shopMemberships.find((m) => m.barbershopId === preferredId)
    : null
  ) ?? shopMemberships[0] ?? null;

  const membership = adminMembership ?? shopMembership;
  const isAdmin = !!adminMembership;

  return {
    user: {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      barbershopId: shopMembership?.barbershopId ?? null,
      barbershopSlug: shopMembership?.barbershop?.slug ?? null,
      role: shopMembership?.role ?? membership?.role ?? null,
      isAdmin,
      memberships: shopMemberships.map((m) => ({
        barbershopId:   m.barbershopId,
        barbershopName: m.barbershop.name,
        role:           m.role,
      })),
    },
  };
}
