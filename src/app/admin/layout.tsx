import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminSidebar } from "./admin-sidebar";

const ADMIN_EMAIL = "ss.diegosilva@gmail.com";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user || !session.user.isAdmin || session.user.email !== ADMIN_EMAIL) {
    redirect("/login");
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
