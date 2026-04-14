import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { AiLimitModal } from "@/components/ui/ai-limit-modal";
import { prisma } from "@/lib/prisma";
import { checkAiAllowance } from "@/lib/billing";
import { getSegmentTheme } from "@/lib/core/segment";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Load barbershop name + AI usage + segment theme for sidebar
  let barbershopName: string | null = null;
  let aiUsed      = 0;
  let aiLimit     = 30;
  let aiCredits   = 0;
  let aiTrialing  = false;
  let segmentTheme: Awaited<ReturnType<typeof getSegmentTheme>> = null;

  if (session.user.barbershopId) {
    const [shop, allowance, theme] = await Promise.all([
      prisma.barbershop.findUnique({
        where:  { id: session.user.barbershopId },
        select: { name: true },
      }),
      checkAiAllowance(session.user.barbershopId),
      getSegmentTheme(session.user.barbershopId),
    ]);
    barbershopName = shop?.name ?? null;
    aiUsed     = allowance.used;
    aiLimit    = allowance.limit === Infinity ? 999 : allowance.limit;
    aiCredits  = allowance.creditsRemaining;
    aiTrialing = allowance.planStatus === "TRIALING";
    segmentTheme = theme;
  }

  const memberships = session.user.memberships ?? [];

  // Parse available modules from segment theme
  let availableModules: string[] = [];
  if (segmentTheme?.availableModules) {
    try {
      const parsed = JSON.parse(segmentTheme.availableModules);
      if (Array.isArray(parsed)) {
        availableModules = parsed;
      } else {
        console.warn("[layout] availableModules is not an array:", segmentTheme.availableModules);
      }
    } catch {
      console.warn("[layout] Failed to parse availableModules JSON:", segmentTheme.availableModules);
    }
  }

  // Build CSS variable override for the segment's primary color
  const segmentCssVars = segmentTheme?.colorPrimary
    ? `--primary: ${segmentTheme.colorPrimary}; --ring: ${segmentTheme.colorPrimary};`
    : null;

  return (
    <>
      {segmentCssVars && (
        <style>{`:root { ${segmentCssVars} }`}</style>
      )}
      <div className="flex h-dvh overflow-hidden bg-background">
        <Sidebar
          barbershopName={barbershopName}
          activeBarbershopId={session.user.barbershopId}
          memberships={memberships}
          className="hidden md:flex"
          aiUsed={aiUsed}
          aiLimit={aiLimit}
          aiCredits={aiCredits}
          aiTrialing={aiTrialing}
          segmentIcon={segmentTheme?.icon ?? undefined}
          availableModules={availableModules.length > 0 ? availableModules : undefined}
        />
        <main className="flex-1 overflow-y-auto">
          <MobileNav
            barbershopName={barbershopName}
            userName={session.user.name ?? null}
            availableModules={availableModules.length > 0 ? availableModules : undefined}
          />
          {children}
        </main>
        <AiLimitModal />
      </div>
    </>
  );
}
