// Edge-compatible auth config (no Prisma, no heavy deps)
// Used in middleware only. Full config (with PrismaAdapter) is in lib/auth.ts

import type { NextAuthConfig } from "next-auth";

const PUBLIC = ["/login", "/signup", "/onboarding", "/api/auth", "/api/stripe/webhook", "/api/cron"];

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [], // real providers are in lib/auth.ts
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isPublic = PUBLIC.some((p) => nextUrl.pathname.startsWith(p));
      if (isPublic) return true;
      return !!auth?.user;
    },
  },
};
