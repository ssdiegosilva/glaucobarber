import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/utils";
import { Scissors } from "lucide-react";

const CATEGORY_LABEL = { HAIRCUT: "Corte", BEARD: "Barba", COMBO: "Combo", TREATMENT: "Tratamento", OTHER: "Outro" };
const CATEGORY_VARIANT = { HAIRCUT: "default", BEARD: "info", COMBO: "success", TREATMENT: "warning", OTHER: "outline" } as const;

export default async function ServicesPage() {
  const session = await auth();
  if (!session?.user?.barbershopId) redirect("/onboarding");

  const services = await prisma.service.findMany({
    where:   { barbershopId: session.user.barbershopId },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Serviços"
        subtitle="Catálogo sincronizado da Trinks"
        userName={session.user.name}
      />

      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((s) => (
            <div key={s.id} className="rounded-lg border border-border bg-card p-4 hover:border-gold-500/20 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold-500/10 border border-gold-500/20">
                  <Scissors className="h-5 w-5 text-gold-400" />
                </div>
                <div className="flex gap-1.5">
                  <Badge variant={CATEGORY_VARIANT[s.category] as never} className="text-[10px]">
                    {CATEGORY_LABEL[s.category]}
                  </Badge>
                  {!s.active && <Badge variant="destructive" className="text-[10px]">Inativo</Badge>}
                </div>
              </div>
              <p className="font-semibold text-foreground">{s.name}</p>
              {s.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.description}</p>}
              <div className="flex items-center justify-between mt-4">
                <p className="text-lg font-bold text-gold-400">{formatBRL(Number(s.price))}</p>
                <p className="text-xs text-muted-foreground">{s.durationMin} min</p>
              </div>
              {s.syncedFromTrinks && (
                <p className="text-[10px] text-muted-foreground/50 mt-2">Origem: Trinks</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
