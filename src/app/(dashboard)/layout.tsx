import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { prisma } from "@/lib/prisma";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Load barbershop name for sidebar
  let barbershopName: string | null = null;
  if (session.user.barbershopId) {
    const shop = await prisma.barbershop.findUnique({
      where:  { id: session.user.barbershopId },
      select: { name: true },
    });
    barbershopName = shop?.name ?? null;
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar barbershopName={barbershopName} className="hidden md:flex" />
      <main className="flex-1 overflow-y-auto">
        <MobileNav barbershopName={barbershopName} />
        {children}
      </main>
    </div>
  );
}
