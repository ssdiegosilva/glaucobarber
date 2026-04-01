import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadCampaignImage } from "@/lib/storage";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const campaignId = (form.get("campaignId") as string | null) ?? "generic";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie um arquivo de imagem" }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Imagem acima de 10MB" }, { status: 400 });
  }

  const mimeExt: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };

  const origName = (file as File).name ?? "upload";
  const guessedExt = origName.includes(".") ? origName.split(".").pop() || "jpg" : "jpg";
  const ext = mimeExt[file.type] ?? guessedExt;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  try {
    const uploaded = await uploadCampaignImage({
      barbershopId: session.user.barbershopId,
      campaignId,
      fileName: `${campaignId}.${ext}`,
      buffer,
      contentType: file.type || "image/jpeg",
    });

    return NextResponse.json({ url: uploaded.url, path: uploaded.path });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export const runtime = "nodejs";
