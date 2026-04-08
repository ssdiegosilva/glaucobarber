import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadVitrineFoto } from "@/lib/storage";

export async function GET() {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const posts = await prisma.vitrinPost.findMany({
    where: {
      barbershopId: session.user.barbershopId,
      status: { not: "DISMISSED" },
    },
    include: {
      images: { orderBy: { position: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ posts });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const files = formData.getAll("images") as File[];

  if (!files || files.length === 0) {
    return NextResponse.json({ error: "Ao menos 1 foto é obrigatória" }, { status: 400 });
  }
  if (files.length > 3) {
    return NextResponse.json({ error: "Máximo de 3 fotos por post" }, { status: 400 });
  }

  // Create the post first to get an ID
  const post = await prisma.vitrinPost.create({
    data: { barbershopId: session.user.barbershopId },
  });

  // Upload each photo
  const imageDatas: { path: string; position: number }[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const buffer = Buffer.from(await file.arrayBuffer());
    const fotoId = `${Date.now()}-${i}`;
    // Sanitize content type: strip parameters (e.g. "image/heic;codecs=hvc1")
    // and normalize HEIC/HEIF to jpeg (browser on iOS may send these)
    const rawType = (file.type || "image/jpeg").split(";")[0].trim().toLowerCase();
    const HEIC_TYPES: Record<string, string> = { "image/heic": "image/jpeg", "image/heif": "image/jpeg" };
    const contentType = HEIC_TYPES[rawType] ?? (rawType.startsWith("image/") ? rawType : "image/jpeg");
    const { path } = await uploadVitrineFoto({
      barbershopId: session.user.barbershopId,
      postId: post.id,
      fotoId,
      buffer,
      contentType,
    });
    imageDatas.push({ path, position: i });
  }

  await prisma.vitrineFoto.createMany({
    data: imageDatas.map(({ path, position }) => ({
      vitrinPostId: post.id,
      path,
      position,
    })),
  });

  const fullPost = await prisma.vitrinPost.findUnique({
    where: { id: post.id },
    include: { images: { orderBy: { position: "asc" } } },
  });

  return NextResponse.json({ post: fullPost }, { status: 201 });
}
