import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── GET /api/products?q= ─────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const all = searchParams.get("all") === "true"; // include inactive/deleted

  const products = await prisma.product.findMany({
    where: {
      barbershopId: session.user.barbershopId,
      ...(all ? {} : { active: true, deletedAt: null }),
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, price: true, category: true, description: true, active: true, imageUrl: true, deletedAt: true },
  });

  return NextResponse.json({
    products: products.map((p) => ({ ...p, price: Number(p.price) })),
  });
}

// ── POST /api/products ───────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { name?: string; price?: number | string; category?: string; description?: string; imageUrl?: string };

  if (!body.name?.trim()) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
  const price = Number(body.price);
  if (isNaN(price) || price < 0) return NextResponse.json({ error: "Preço inválido" }, { status: 400 });

  const product = await prisma.product.create({
    data: {
      barbershopId: session.user.barbershopId,
      name:         body.name.trim(),
      price,
      category:     body.category?.trim() || null,
      description:  body.description?.trim() || null,
      imageUrl:     body.imageUrl?.trim() || null,
    },
  });

  return NextResponse.json({ product: { ...product, price: Number(product.price) } });
}
