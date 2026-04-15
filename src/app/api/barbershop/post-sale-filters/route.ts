import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_VISIBLE = 4;
const DEFAULT_KEYS = new Set(["emRisco", "recentes", "inativos", "reativados"]);

interface PostSaleFilterConfig {
  defaults: Record<string, boolean>;
  custom: Array<{
    id: string;
    serviceId: string;
    serviceName: string;
    followUpDays: number;
    enabled: boolean;
  }>;
  visible: string[];
}

function parseConfig(raw: string): PostSaleFilterConfig {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && parsed.defaults) {
      return parsed as PostSaleFilterConfig;
    }
  } catch { /* fallback */ }
  return {
    defaults: { emRisco: true, recentes: true, inativos: true, reativados: true },
    custom: [],
    visible: ["emRisco", "recentes", "inativos", "reativados"],
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const shop = await prisma.barbershop.findUnique({
    where: { id: session.user.barbershopId },
    select: { postSaleFilters: true },
  });

  return NextResponse.json(parseConfig(shop?.postSaleFilters ?? "[]"));
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as PostSaleFilterConfig;

  // Validate structure
  if (!body.defaults || !Array.isArray(body.custom) || !Array.isArray(body.visible)) {
    return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
  }

  // Validate visible max
  if (body.visible.length > MAX_VISIBLE) {
    return NextResponse.json({ error: `Máximo de ${MAX_VISIBLE} filtros visíveis` }, { status: 400 });
  }

  // Validate visible entries reference valid keys
  const customIds = new Set(body.custom.map((c) => c.id));
  for (const key of body.visible) {
    if (!DEFAULT_KEYS.has(key) && !customIds.has(key)) {
      return NextResponse.json({ error: `Filtro "${key}" não encontrado` }, { status: 400 });
    }
  }

  // Validate custom filters have required fields
  for (const f of body.custom) {
    if (!f.id || !f.serviceId || !f.serviceName || !f.followUpDays) {
      return NextResponse.json({ error: "Filtro customizado incompleto" }, { status: 400 });
    }
  }

  await prisma.barbershop.update({
    where: { id: session.user.barbershopId },
    data: { postSaleFilters: JSON.stringify(body) },
  });

  return NextResponse.json({ ok: true, config: body });
}
