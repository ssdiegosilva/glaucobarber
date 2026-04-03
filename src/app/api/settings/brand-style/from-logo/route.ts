import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/lib/ai/provider";
import { checkAiAllowance, consumeAiCredit } from "@/lib/billing";

const FALLBACK_STYLE = "Barbearia premium: preto e dourado, iluminação dramática, metal escovado, tipografia serifada elegante, clima masculino e sofisticado.";

export async function POST(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const barbershop = await prisma.barbershop.findUnique({
    where:  { id: session.user.barbershopId },
    select: { id: true, name: true, logoUrl: true },
  });

  if (!barbershop) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ai = getAIProvider();
  let brandStyle = "";
  let origin: "logo" | "fallback" = "fallback";

  if (barbershop.logoUrl) {
    const allowance = await checkAiAllowance(barbershop.id);
    if (!allowance.allowed) {
      return NextResponse.json({ error: "ai_limit_reached", message: "Limite de IA atingido.", upgradeUrl: "/billing" }, { status: 402 });
    }

    try {
      brandStyle = await ai.generateBrandStyleFromLogo(barbershop.logoUrl, barbershop.name);
      brandStyle = brandStyle.trim().slice(0, 300);
      if (brandStyle) {
        origin = "logo";
        await consumeAiCredit(barbershop.id, "brand_style_logo");
      }
    } catch (e) {
      // fallback handled below
      console.error("[brand-style/from-logo] AI error", e);
    }
  }

  if (!brandStyle) {
    brandStyle = FALLBACK_STYLE;
    origin = "fallback";
  }

  const updated = await prisma.barbershop.update({
    where: { id: barbershop.id },
    data:  { brandStyle },
    select: { brandStyle: true },
  });

  return NextResponse.json({ brandStyle: updated.brandStyle ?? "", origin });
}
