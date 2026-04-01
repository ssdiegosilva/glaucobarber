import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const templates = await prisma.template.findMany({
    where: { OR: [{ barbershopId: session.user.barbershopId }, { isGlobal: true }] },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, type, imageUrl, thumbUrl, isGlobal } = await req.json();
  if (!name || !imageUrl) return NextResponse.json({ error: "Nome e imageUrl são obrigatórios" }, { status: 400 });

  const tpl = await prisma.template.create({
    data: {
      barbershopId: session.user.barbershopId,
      name,
      type: type ?? "post",
      imageUrl,
      thumbUrl,
      isGlobal: isGlobal ?? false,
    },
  });

  return NextResponse.json({ template: tpl });
}
