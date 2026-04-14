"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, BadgePercent, Users, Calendar, ChevronRight, Tag } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";

type Offer = {
  id: string;
  title: string;
  type: string;
  referenceNames: string[];
  daysInactive: number;
  discount: boolean;
  discountPct: number | null;
  customersCount: number;
  status: string;
  createdAt: string;
};

export function OfertasClient({ initialOffers }: { initialOffers: Offer[] }) {
  const [offers] = useState<Offer[]>(initialOffers);
  const router = useRouter();

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
      {/* Header action */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {offers.length > 0
            ? `${offers.length} oferta${offers.length !== 1 ? "s" : ""} criada${offers.length !== 1 ? "s" : ""}`
            : "Nenhuma oferta criada ainda"}
        </p>
        <Button
          onClick={() => router.push("/ofertas/nova")}
          className="bg-gold-500 hover:bg-gold-400 text-black gap-2 shrink-0"
        >
          <Plus className="h-4 w-4" /> Nova Oferta
        </Button>
      </div>

      {/* List */}
      {offers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <div className="h-14 w-14 rounded-2xl bg-surface-800 border border-border flex items-center justify-center">
            <BadgePercent className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">Nenhuma oferta direcionada ainda</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Crie ofertas personalizadas para reengajar clientes que não compram há algum tempo.
          </p>
          <Button
            onClick={() => router.push("/ofertas/nova")}
            className="mt-2 bg-gold-500 hover:bg-gold-400 text-black gap-2"
          >
            <Plus className="h-4 w-4" /> Criar primeira oferta
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="divide-y divide-border">
            {offers.map((o) => (
              <Link
                key={o.id}
                href={`/ofertas/${o.id}`}
                className="flex items-center gap-4 px-4 py-4 hover:bg-surface-800/40 transition-colors group"
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <BadgePercent className="h-5 w-5 text-primary" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{o.title}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-700 border border-border text-muted-foreground">
                      {o.type === "product" ? "produto" : "serviço"}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-700 border border-border text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-2.5 w-2.5" />
                      +{o.daysInactive}d sem comprar
                    </span>
                    {o.discount && o.discountPct && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 flex items-center gap-1">
                        <Tag className="h-2.5 w-2.5" />
                        {o.discountPct}% off
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground truncate hidden sm:inline">
                      {o.referenceNames.slice(0, 2).join(", ")}
                      {o.referenceNames.length > 2 ? ` +${o.referenceNames.length - 2}` : ""}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0 space-y-1">
                  <div className="flex items-center gap-1 justify-end text-sm font-medium text-foreground">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    {o.customersCount}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(o.createdAt), "dd/MM/yy", { locale: ptBR })}
                  </p>
                </div>

                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
