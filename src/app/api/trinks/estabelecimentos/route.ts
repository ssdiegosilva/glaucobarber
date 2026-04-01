import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { TrinksClient } from "@/lib/integrations/trinks/client";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { apiKey } = await req.json();
  if (!apiKey?.trim()) {
    return NextResponse.json({ error: "API Key obrigatória" }, { status: 400 });
  }

  try {
    const client = new TrinksClient({ apiKey: apiKey.trim(), estabelecimentoId: "" });
    const res = await client.getEstabelecimentos();
    return NextResponse.json({ items: res.data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
