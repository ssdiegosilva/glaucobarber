import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SupportAdminClient } from "./support-admin-client";

export default async function AdminSupportPage() {
  const session = await auth();
  if (!session?.user?.isAdmin) redirect("/login");

  const [messages, unreadCount] = await Promise.all([
    prisma.supportMessage.findMany({
      where:   { status: { not: "CLOSED" } },
      orderBy: [{ readByAdmin: "asc" }, { createdAt: "asc" }],
      include: {
        barbershop: { select: { id: true, name: true } },
        user:       { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.supportMessage.count({ where: { readByAdmin: false } }),
  ]);

  return (
    <SupportAdminClient
      initialMessages={messages.map((m) => ({
        id:          m.id,
        body:        m.body,
        adminReply:  m.adminReply,
        status:      m.status,
        readByAdmin: m.readByAdmin,
        createdAt:   m.createdAt.toISOString(),
        repliedAt:   m.repliedAt?.toISOString() ?? null,
        barbershop:  m.barbershop,
        user:        { id: m.user.id, name: m.user.name, email: m.user.email },
      }))}
      initialUnreadCount={unreadCount}
    />
  );
}
