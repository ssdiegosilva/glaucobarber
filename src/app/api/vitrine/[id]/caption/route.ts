import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/lib/ai/provider";
import { checkAiAllowance, consumeAiCredit } from "@/lib/billing";
import { getKillSwitch } from "@/lib/platform-config";
import { signVitrineFoto } from "@/lib/storage";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  if (await getKillSwitch("kill_vitrine")) {
    return NextResponse.json({ error: "Funcionalidade temporariamente desabilitada" }, { status: 503 });
  }

  const post = await prisma.vitrinPost.findFirst({
    where: { id, barbershopId: session.user.barbershopId },
    include: { images: { orderBy: { position: "asc" }, take: 1 } },
  });
  if (!post) return NextResponse.json({ error: "Post não encontrado" }, { status: 404 });
  if (post.images.length === 0) return NextResponse.json({ error: "Post sem fotos" }, { status: 400 });

  const allowance = await checkAiAllowance(session.user.barbershopId);
  if (!allowance.allowed) {
    return NextResponse.json(
      { error: "ai_limit_reached", message: "Limite de IA atingido. Adicione créditos para continuar.", upgradeUrl: "/billing" },
      { status: 402 },
    );
  }

  // Get signed URL for the main photo, fetch as base64
  const mainPhoto = post.images[0];
  const signedUrl = await signVitrineFoto(mainPhoto.path);
  if (!signedUrl) return NextResponse.json({ error: "Erro ao acessar a foto" }, { status: 500 });

  const imgRes = await fetch(signedUrl);
  const imgBuffer = await imgRes.arrayBuffer();
  const imageBase64 = Buffer.from(imgBuffer).toString("base64");

  const barbershop = await prisma.barbershop.findUnique({
    where: { id: session.user.barbershopId },
    select: { name: true, brandStyle: true },
  });

  const ai = getAIProvider();
  const { caption } = await ai.generateVitrinCaption(imageBase64, barbershop?.name ?? "Barbearia", barbershop?.brandStyle, session.user.barbershopId);

  await consumeAiCredit(session.user.barbershopId, "vitrine_caption");

  await prisma.vitrinPost.update({
    where: { id },
    data: { caption },
  });

  return NextResponse.json({ caption });
}
