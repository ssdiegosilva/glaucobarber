import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { accessToken, businessId, pageId, username } = await req.json();
  if (!accessToken || !businessId) {
    return NextResponse.json({ error: "Preencha token e Instagram Business ID" }, { status: 400 });
  }

  await prisma.integration.upsert({
    where: { barbershopId: session.user.barbershopId },
    update: {
      instagramPageAccessToken: accessToken,
      instagramBusinessId: businessId,
      instagramPageId: pageId ?? null,
      instagramUsername: username ?? null,
      status: "ACTIVE",
    },
    create: {
      barbershopId: session.user.barbershopId,
      provider: "trinks",
      status: "ACTIVE",
      instagramPageAccessToken: accessToken,
      instagramBusinessId: businessId,
      instagramPageId: pageId ?? null,
      instagramUsername: username ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.integration.updateMany({
    where: { barbershopId: session.user.barbershopId },
    data: {
      instagramPageAccessToken: null,
      instagramBusinessId:      null,
      instagramPageId:          null,
      instagramUsername:        null,
    },
  });

  return NextResponse.json({ ok: true });
}
