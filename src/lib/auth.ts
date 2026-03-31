import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(6),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },

  pages: {
    signIn:  "/login",
    newUser: "/onboarding",
    error:   "/login",
  },

  providers: [
    Google({
      clientId:     process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),

    Credentials({
      name: "Email & Senha",
      credentials: {
        email:    { label: "Email",    type: "email" },
        password: { label: "Senha",    type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });

        if (!user || !user.passwordHash) return null;

        // NOTE: In production, use bcrypt to compare.
        // import { compare } from "bcryptjs"
        // const valid = await compare(parsed.data.password, user.passwordHash);
        // For demo seed (no real passwords), bypass:
        const valid = parsed.data.password === "demo1234";
        if (!valid) return null;

        return {
          id:    user.id,
          name:  user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;

        // Load active membership for the JWT
        const membership = await prisma.membership.findFirst({
          where: { userId: user.id as string, active: true },
          include: { barbershop: true },
          orderBy: { createdAt: "asc" },
        });

        token.barbershopId   = membership?.barbershopId ?? null;
        token.barbershopSlug = membership?.barbershop?.slug ?? null;
        token.role           = membership?.role ?? null;
      }
      return token;
    },

    async session({ session, token }) {
      session.user.id            = token.id as string;
      session.user.barbershopId  = token.barbershopId as string | null;
      session.user.barbershopSlug = token.barbershopSlug as string | null;
      session.user.role          = token.role as string | null;
      return session;
    },
  },
});

// Extend next-auth types
declare module "next-auth" {
  interface Session {
    user: {
      id:             string;
      name?:          string | null;
      email?:         string | null;
      image?:         string | null;
      barbershopId:   string | null;
      barbershopSlug: string | null;
      role:           string | null;
    };
  }
}
