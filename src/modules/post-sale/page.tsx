import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { SummaryCards } from "./components/SummaryCards";
import { PostSaleTabs, TabsContent } from "./components/Tabs";
import { CustomersTable } from "./components/CustomersTable";
import { getPostSaleSummary, listAtRisk, listRecent, listInactive, listReactivated } from "./service";

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
            <CustomersTable rows={risk.items} />
          </TabsContent>
          <TabsContent value="risk">
            <CustomersTable rows={risk.items} />
          </TabsContent>
          <TabsContent value="reviews">
            <p className="text-sm text-muted-foreground">Wire reviews list</p>
          </TabsContent>
          <TabsContent value="recent">
            <CustomersTable rows={recent.items} />
          </TabsContent>
          <TabsContent value="followups">
            <p className="text-sm text-muted-foreground">Histórico sob demanda</p>
          </TabsContent>
          <TabsContent value="inactive">
            <CustomersTable rows={inactive.items} />
          </TabsContent>
        </PostSaleTabs>
      </div>
    </div>
  );
}
