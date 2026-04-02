import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { prisma } from "@/lib/prisma";
import { checkAiAllowance } from "@/lib/billing";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Admins should not be in the dashboard
  if (session.user.isAdmin) {
    redirect("/admin");
  }

  // Load barbershop name + AI usage for sidebar
  let barbershopName: string | null = null;
  let aiUsed = 0;
  let aiLimit = 30;
  let aiCredits = 0;

  if (session.user.barbershopId) {
    const [shop, allowance] = await Promise.all([
      prisma.barbershop.findUnique({
        where:  { id: session.user.barbershopId },
        select: { name: true },
      }),
      checkAiAllowance(session.user.barbershopId),
    ]);
    barbershopName = shop?.name ?? null;
    aiUsed    = allowance.used;
    aiLimit   = allowance.limit === Infinity ? 999 : allowance.limit;
    aiCredits = allowance.creditsRemaining;
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar
        barbershopName={barbershopName}
        className="hidden md:flex"
        aiUsed={aiUsed}
        aiLimit={aiLimit}
        aiCredits={aiCredits}
      />
      <main className="flex-1 overflow-y-auto">
        <MobileNav barbershopName={barbershopName} />
        {children}
      </main>
    </div>
  );
}
