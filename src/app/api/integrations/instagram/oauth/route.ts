import { NextResponse } from "next/server";
import { cookies }      from "next/headers";
import { auth }         from "@/lib/auth";
import { generateState } from "@/lib/integrations/instagram/oauth";

const APP_ID  = process.env.INSTAGRAM_APP_ID;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

const SCOPES = [
  "pages_show_list",
  "instagram_basic",
  "instagram_content_publish",
].join(",");

export async function GET() {
  if (!APP_ID) {
    return NextResponse.redirect(`${APP_URL}/settings?ig=error&msg=OAuth+n%C3%A3o+configurado+no+servidor`);
  }

  const session = await auth();
  if (!session?.user?.barbershopId) {
    return NextResponse.redirect(`${APP_URL}/login`);
  }

  const state       = generateState(session.user.barbershopId);
  const redirectUri = `${APP_URL}/api/integrations/instagram/callback`;

  const oauthUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  oauthUrl.searchParams.set("client_id",    APP_ID);
  oauthUrl.searchParams.set("redirect_uri", redirectUri);
  oauthUrl.searchParams.set("scope",        SCOPES);
  oauthUrl.searchParams.set("state",        state);
  oauthUrl.searchParams.set("response_type","code");

  const jar = await cookies();
  jar.set("ig_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge:   60 * 10, // 10 minutes
    path:     "/",
  });

  return NextResponse.redirect(oauthUrl.toString());
}
