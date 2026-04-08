import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { signVitrineFoto } from "@/lib/storage";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const path = req.nextUrl.searchParams.get("path");
  if (!path) return NextResponse.json({ error: "path obrigatório" }, { status: 400 });

  // Security: only allow paths belonging to the current barbershop
  if (!path.includes(session.user.barbershopId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = await signVitrineFoto(path);
  if (!url) return NextResponse.json({ error: "Foto não encontrada" }, { status: 404 });

  return NextResponse.redirect(url);
}
