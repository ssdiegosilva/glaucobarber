import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_WIDGETS = 3;
const VALID_KEYS = new Set([
  "revenue_today", "occupancy_today", "inactive_clients",
  "monthly_goal", "avg_ticket", "new_clients",
  "return_rate", "pending_apts", "weekly_revenue",
  "top_service", "whatsapp_queue",
]);

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { widgets } = await req.json();
  if (!Array.isArray(widgets)) return NextResponse.json({ error: "widgets must be an array" }, { status: 400 });
  if (widgets.length > MAX_WIDGETS) return NextResponse.json({ error: `Máximo de ${MAX_WIDGETS} widgets` }, { status: 400 });
  if (widgets.some((w) => !VALID_KEYS.has(w))) return NextResponse.json({ error: "Widget inválido" }, { status: 400 });

  await prisma.barbershop.update({
    where: { id: session.user.barbershopId },
    data:  { dashboardWidgets: JSON.stringify(widgets) },
  });

  return NextResponse.json({ ok: true, widgets });
}
