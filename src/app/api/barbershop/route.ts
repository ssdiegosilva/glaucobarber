import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function normalizeSlug(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const allowedFields = ["name", "email", "phone", "address", "city", "state", "websiteUrl", "description", "slug", "logoUrl"] as const;

type BarbershopUpdate = Partial<Record<(typeof allowedFields)[number], string>>;

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as BarbershopUpdate;
  const name = body.name?.trim();
  const slugRaw = body.slug?.trim();

  if (!name || !slugRaw) {
    return NextResponse.json({ error: "Nome e slug são obrigatórios" }, { status: 400 });
  }

  const slug = normalizeSlug(slugRaw);
  if (!slug) {
    return NextResponse.json({ error: "Slug inválido" }, { status: 400 });
  }

  const conflict = await prisma.barbershop.findFirst({
    where: {
      slug,
      NOT: { id: session.user.barbershopId },
    },
    select: { id: true },
  });
  if (conflict) {
    return NextResponse.json({ error: "Slug já está em uso" }, { status: 409 });
  }

  const data: BarbershopUpdate = { slug, name };
  for (const key of allowedFields) {
    if (key === "slug" || key === "name") continue;
    if (typeof body[key] === "string") {
      data[key] = (body[key] as string).trim();
    }
  }

  const updated = await prisma.barbershop.update({
    where: { id: session.user.barbershopId },
    data,
  });

  return NextResponse.json({ barbershop: updated });
}
