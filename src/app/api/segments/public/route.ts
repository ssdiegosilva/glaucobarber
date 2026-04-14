import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/segments/public — returns active segments for onboarding selection
// No authentication required (user may not be authenticated during onboarding step 1)
export async function GET() {
  const segments = await prisma.segment.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      key: true,
      displayName: true,
      tenantLabel: true,
      description: true,
      icon: true,
      colorPrimary: true,
    },
  });

  return NextResponse.json(segments);
}
