import { NextRequest, NextResponse } from "next/server";
import { cookies }                   from "next/headers";
import { prisma }                    from "@/lib/prisma";
import {
  parseState,
  fetchInstagramAccounts,
  signHmac,
} from "@/lib/integrations/instagram/oauth";

const APP_ID     = process.env.INSTAGRAM_APP_ID!;
const APP_SECRET = process.env.INSTAGRAM_APP_SECRET!;
const APP_URL    = process.env.NEXT_PUBLIC_APP_URL!;

function redirectSettings(params: Record<string, string>) {
  const url = new URL(`${APP_URL}/settings`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return NextResponse.redirect(url.toString());
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return redirectSettings({ ig: "error", msg: "Acesso negado pelo usuário" });
  }
  if (!code || !state) {
    return redirectSettings({ ig: "error", msg: "Parâmetros inválidos na resposta do Meta" });
  }

  // Verify CSRF state via cookie
  const jar        = await cookies();
  const savedState = jar.get("ig_oauth_state")?.value;
  jar.delete("ig_oauth_state");

  if (!savedState || savedState !== state) {
    return redirectSettings({ ig: "error", msg: "State inválido — tente novamente" });
  }

  const parsed = parseState(state);
  if (!parsed) {
    return redirectSettings({ ig: "error", msg: "State corrompido" });
  }

  const { barbershopId } = parsed;
  const redirectUri      = `${APP_URL}/api/integrations/instagram/callback`;

  // Exchange code → short-lived user token
  let shortToken: string;
  try {
    const res  = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token` +
      `?client_id=${APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&client_secret=${APP_SECRET}&code=${code}`
    );
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error?.message ?? "Falha na troca de token");
    shortToken = json.access_token;
  } catch (e) {
    return redirectSettings({ ig: "error", msg: String(e) });
  }

  // Exchange → long-lived user token (60 days)
  let longToken: string;
  try {
    const res  = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token` +
      `?grant_type=fb_exchange_token&client_id=${APP_ID}` +
      `&client_secret=${APP_SECRET}&fb_exchange_token=${shortToken}`
    );
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error?.message ?? "Falha ao obter token de longa duração");
    longToken = json.access_token;
  } catch (e) {
    return redirectSettings({ ig: "error", msg: String(e) });
  }

  // Discover Instagram Business accounts
  let accounts;
  try {
    accounts = await fetchInstagramAccounts(longToken);
  } catch (e) {
    return redirectSettings({ ig: "error", msg: String(e) });
  }

  if (accounts.length === 0) {
    return redirectSettings({
      ig:  "error",
      msg: "Nenhuma conta Instagram Business encontrada vinculada às suas páginas",
    });
  }

  // Single account → auto-save and done
  if (accounts.length === 1) {
    const acc = accounts[0];
    await prisma.integration.upsert({
      where:  { barbershopId },
      update: {
        instagramPageAccessToken: acc.pageToken,
        instagramBusinessId:      acc.instagramId,
        instagramPageId:          acc.pageId,
        instagramUsername:        acc.instagramName,
        status:                   "ACTIVE",
      },
      create: {
        barbershopId,
        provider:                 "trinks",
        status:                   "ACTIVE",
        instagramPageAccessToken: acc.pageToken,
        instagramBusinessId:      acc.instagramId,
        instagramPageId:          acc.pageId,
        instagramUsername:        acc.instagramName,
      },
    });
    return redirectSettings({ ig: "connected" });
  }

  // Multiple accounts → store in signed cookie for picker
  const payload     = JSON.stringify(accounts);
  const sig         = signHmac(payload);
  const cookieValue = `${Buffer.from(payload).toString("base64")}:${sig}`;

  jar.set("ig_pending", cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    maxAge:   60 * 5, // 5 minutes
    path:     "/",
  });

  return redirectSettings({ ig: "pending" });
}
