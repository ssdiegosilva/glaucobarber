import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Lightweight Edge middleware — uses JWT only, no Prisma.
// Full auth config (with PrismaAdapter) lives in lib/auth.ts and is
// used only in server-side route handlers.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
