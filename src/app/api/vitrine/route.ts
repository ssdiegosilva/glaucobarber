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
    // Sanitize content type: strip parameters and map to an allowlisted MIME type.
    // On iOS, drag-and-drop or HEIC photos may produce types like "image/heic",
    // "image/heif", UTI strings ("public.jpeg"), or empty values — all of which
    // Supabase Storage rejects with "The string did not match the expected pattern."
    const rawType = (file.type || "").split(";")[0].trim().toLowerCase();
    const MIME_MAP: Record<string, string> = {
      "image/heic":  "image/jpeg",
      "image/heif":  "image/jpeg",
      "image/avif":  "image/jpeg",
    };
    const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp", "image/tiff"]);
    const contentType = MIME_MAP[rawType] ?? (ALLOWED.has(rawType) ? rawType : "image/jpeg");
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
