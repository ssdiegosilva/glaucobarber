import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadProductImage } from "@/lib/storage";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.product.findFirst({
    where: { id, barbershopId: session.user.barbershopId, deletedAt: null },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Envie um arquivo de imagem" }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Imagem acima de 5MB" }, { status: 400 });

  const mimeExt: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png":  "png",
    "image/webp": "webp",
    "image/gif":  "gif",
  };
  const origName = file.name ?? "product";
  const guessedExt = origName.includes(".") ? origName.split(".").pop() || "jpg" : "jpg";
  const ext = mimeExt[file.type] ?? guessedExt;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  try {
    const uploaded = await uploadProductImage({
      barbershopId: session.user.barbershopId,
      productId: `${id}.${ext}`,
      buffer,
      contentType: file.type || "image/jpeg",
    });

    await prisma.product.update({ where: { id }, data: { imageUrl: uploaded.url } });
    return NextResponse.json({ url: uploaded.url });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export const runtime = "nodejs";
