import { NextResponse } from "next/server";
import { cookies }      from "next/headers";
import { auth }         from "@/lib/auth";
import { verifyHmac }   from "@/lib/integrations/instagram/oauth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jar = await cookies();
  const raw = jar.get("ig_pending")?.value;
  if (!raw) return NextResponse.json({ error: "Nenhuma conta pendente" }, { status: 404 });

  const lastColon = raw.lastIndexOf(":");
  if (lastColon === -1) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const b64 = raw.slice(0, lastColon);
  const sig  = raw.slice(lastColon + 1);

  let payload: string;
  try {
    payload = Buffer.from(b64, "base64").toString("utf-8");
  } catch {
    return NextResponse.json({ error: "Encoding inválido" }, { status: 400 });
  }

  if (!verifyHmac(payload, sig)) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 400 });
  }

  return NextResponse.json({ accounts: JSON.parse(payload) });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jar = await cookies();
  jar.delete("ig_pending");
  return NextResponse.json({ ok: true });
}
