import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminSidebar } from "./admin-sidebar";
import { AdminMobileNav } from "./admin-mobile-nav";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user || session.user.email !== ADMIN_EMAIL) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col md:flex-row h-dvh overflow-hidden bg-background">
      <AdminMobileNav />
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
