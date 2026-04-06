import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAIProvider } from "@/lib/ai/provider";
import { checkAiAllowance, consumeAiCredit } from "@/lib/billing";
import { uploadCampaignImage } from "@/lib/storage";
import { getAiImageConfig } from "@/lib/platform-config";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { barbershopId } = session.user;

  const allowance = await checkAiAllowance(barbershopId);
  if (!allowance.allowed) {
    return NextResponse.json(
      { error: "Limite de IA atingido. Faça upgrade do plano para continuar." },
      { status: 402 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  const file = formData.get("photo") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Nenhuma foto enviada" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Foto muito grande. Máximo 10MB." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Formato inválido. Use JPEG, PNG ou WebP." }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString("base64");

  const ai = getAIProvider();

  // Step 1: Analyze face and get haircut suggestion (text only — no credit charge)
  let suggestion;
  try {
    suggestion = await ai.analyzeAndSuggestHaircut(base64);
  } catch (err) {
    console.error("[criar-visual] analyzeAndSuggestHaircut error:", err);
    return NextResponse.json({ error: "Erro ao analisar a foto. Tente novamente." }, { status: 500 });
  }

  // Step 2: Generate visual — single credit charge for the full operation
  const aiConfig = await getAiImageConfig();
  let imageResult;
  try {
    imageResult = await ai.generateHaircutVisual(buffer, suggestion.suggestedStyle, aiConfig.quality);
  } catch (err) {
    console.error("[criar-visual] generateHaircutVisual error:", err);
    return NextResponse.json({ error: "Erro ao gerar o visual. Tente novamente." }, { status: 500 });
  }

  await consumeAiCredit(barbershopId, "visual_style_generate");

  // Step 3: Upload generated image to Supabase Storage
  const visualId = `visual-${Date.now()}`;
  let imageUrl: string;

  try {
    if ("b64" in imageResult) {
      const imgBuffer = Buffer.from(imageResult.b64, "base64");
      const { url } = await uploadCampaignImage({
        barbershopId,
        campaignId: visualId,
        fileName: `${visualId}.png`,
        buffer: imgBuffer,
        contentType: "image/png",
      });
      imageUrl = url;
    } else {
      const res = await fetch(imageResult.url);
      const imgBuffer = Buffer.from(await res.arrayBuffer());
      const { url } = await uploadCampaignImage({
        barbershopId,
        campaignId: visualId,
        fileName: `${visualId}.jpg`,
        buffer: imgBuffer,
        contentType: "image/jpeg",
      });
      imageUrl = url;
    }
  } catch (err) {
    console.error("[criar-visual] upload error:", err);
    return NextResponse.json({ error: "Erro ao salvar a imagem. Tente novamente." }, { status: 500 });
  }

  return NextResponse.json({
    suggestion,
    imageUrl,
  });
}
