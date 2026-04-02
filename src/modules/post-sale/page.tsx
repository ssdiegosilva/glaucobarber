import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { SummaryCards } from "./components/SummaryCards";
import { PostSaleTabs, TabsContent } from "./components/Tabs";
import { CustomersTable } from "./components/CustomersTable";
import { getPostSaleSummary, listAtRisk, listRecent, listInactive, listReactivated } from "./service";
import type { CustomerSummary } from "./types";

function serializeItems(items: any[]): CustomerSummary[] {
  return items.map((c) => ({
    id:               c.id,
    name:             c.name,
    phone:            c.phone ?? null,
    lastVisitAt:      c.lastCompletedAppointmentAt?.toISOString() ?? null,
    nextAppointmentAt: c.nextAppointmentAt?.toISOString() ?? null,
    postSaleStatus:   c.postSaleStatus,
    churnReason:      c.churnReason ?? null,
    ticketMedio:      c.totalSpent && c.totalVisits ? Number(c.totalSpent) / c.totalVisits : undefined,
    frequencia:       c.totalVisits ?? undefined,
  }));
}

export default async function PostSalePage() {
  const session = await auth();
  if (!session?.user?.barbershopId) redirect("/login");

  const barbershopId = session.user.barbershopId;
  const summary = await getPostSaleSummary(barbershopId);
  const [risk, recent, inactive, reactivated] = await Promise.all([
    listAtRisk(barbershopId, 1, 10),
    listRecent(barbershopId, 1, 10),
    listInactive(barbershopId, 1, 10),
    listReactivated(barbershopId, 1, 10),
  ]);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Pós-venda"
        subtitle="Retenção, reativação e avaliações Google"
        userName={session.user.name}
      />

      <div className="p-6 space-y-4">
        <SummaryCards data={summary} />

        <PostSaleTabs>
          <TabsContent value="overview" className="space-y-3">
            <CustomersTable rows={serializeItems(risk.items)} />
          </TabsContent>
          <TabsContent value="risk">
            <CustomersTable rows={serializeItems(risk.items)} />
          </TabsContent>
          <TabsContent value="reviews">
            <p className="text-sm text-muted-foreground">Wire reviews list</p>
          </TabsContent>
          <TabsContent value="recent">
            <CustomersTable rows={serializeItems(recent.items)} />
          </TabsContent>
          <TabsContent value="followups">
            <p className="text-sm text-muted-foreground">Histórico sob demanda</p>
          </TabsContent>
          <TabsContent value="inactive">
            <CustomersTable rows={serializeItems(inactive.items)} />
          </TabsContent>
        </PostSaleTabs>
      </div>
    </div>
  );
}
