import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.isAdmin) return null;
  return session;
}

// GET /api/admin/features — return full matrix
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const gates = await prisma.planFeatureGate.findMany({
    orderBy: [{ feature: "asc" }, { planTier: "asc" }],
  });

  return NextResponse.json(gates);
}

// POST /api/admin/features — upsert a single gate
// Body: { feature: string, planTier: string, enabled: boolean }
export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { feature, planTier, enabled } = await req.json();
  if (!feature || !planTier || typeof enabled !== "boolean") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const gate = await prisma.planFeatureGate.upsert({
    where:  { feature_planTier: { feature, planTier } },
    update: { enabled },
    create: { feature, planTier, enabled },
  });

  return NextResponse.json(gate);
}
