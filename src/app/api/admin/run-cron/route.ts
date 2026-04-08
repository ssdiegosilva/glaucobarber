import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const CRON_ROUTES: Record<string, string> = {
  "daily":                "/api/cron/daily",
  "hourly-sync":          "/api/cron/hourly-sync",
  "whatsapp-send":        "/api/cron/whatsapp-send",
  "campaigns-publish":    "/api/cron/campaigns-publish",
  "vitrine-publish":      "/api/cron/vitrine-publish",
  "update-image-pricing": "/api/cron/update-image-pricing",
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { cronName } = await req.json();
  const path = CRON_ROUTES[cronName];
  if (!path) {
    return NextResponse.json({ error: "Cron desconhecido" }, { status: 400 });
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET não configurado" }, { status: 500 });
  }

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const res  = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json({ ok: res.ok, status: res.status, data }, { status: res.ok ? 200 : 502 });
}
