import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = ["/", "/login", "/signup", "/forgot-password", "/reset-password", "/auth/callback", "/invite", "/api/invite", "/api/stripe/webhook", "/api/cron"];
const ADMIN_EMAIL  = process.env.ADMIN_EMAIL ?? "";

export async function middleware(req: NextRequest) {
  // Build response object that will carry updated session cookies
  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Propagate updated cookies to both the request and response
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() verifies the JWT with Supabase Auth and refreshes the session if needed
  const { data: { user } } = await supabase.auth.getUser();

  const isPublic    = PUBLIC_PATHS.some((p) => req.nextUrl.pathname.startsWith(p));
  const isAdminPath = req.nextUrl.pathname.startsWith("/admin");

  if (!user && !isPublic) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirectTo", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(redirectUrl);
  }

  // Block /admin for non-admin emails at middleware level
  if (isAdminPath && user?.email !== ADMIN_EMAIL) {
    const loginUrl = new URL("/login", req.url);
    if (!user) loginUrl.searchParams.set("redirectTo", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
