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

const allowedFields = ["name", "email", "phone", "address", "city", "state", "websiteUrl", "description", "slug", "logoUrl", "instagramUrl", "brandStyle", "googleReviewUrl"] as const;

type BarbershopUpdate = Partial<Record<(typeof allowedFields)[number], string>> & { segmentId?: string };

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as BarbershopUpdate;
  const name = body.name?.trim();
  const slugRaw = body.slug?.trim();

  // name and slug are only required when either is explicitly sent
  const updatingIdentity = name !== undefined || slugRaw !== undefined;
  if (updatingIdentity && (!name || !slugRaw)) {
    return NextResponse.json({ error: "Nome e slug são obrigatórios" }, { status: 400 });
  }

  const data: BarbershopUpdate & { segmentId?: string } = {};

  // Handle segmentId separately (not in allowedFields string union)
  if (typeof body.segmentId === "string" && body.segmentId.trim()) {
    const segExists = await prisma.segment.findUnique({ where: { id: body.segmentId.trim() }, select: { id: true } });
    if (!segExists) return NextResponse.json({ error: "Segmento inválido" }, { status: 400 });
    data.segmentId = body.segmentId.trim();
  }

  if (updatingIdentity) {
    const slug = normalizeSlug(slugRaw!);
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

    data.slug = slug;
    data.name = name;
  }

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
