"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Plus, BadgePercent, Users, Calendar, ChevronRight,
  Tag, Trash2, ChevronLeft, Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import { toast } from "@/hooks/use-toast";

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

const PAGE_SIZE = 5;

export function OfertasClient({ initialOffers }: { initialOffers: Offer[] }) {
  const [offers, setOffers] = useState<Offer[]>(initialOffers);
  const [page, setPage]     = useState(1);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const router = useRouter();

  const totalPages = Math.max(1, Math.ceil(offers.length / PAGE_SIZE));
  const paginated  = offers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function deleteOffer(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/targeted-offers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao excluir");
      setOffers((prev) => prev.filter((o) => o.id !== id));
      setConfirmId(null);
      // adjust page if we deleted the last item on the current page
      setPage((p) => {
        const remaining = offers.length - 1;
        const maxPage = Math.max(1, Math.ceil(remaining / PAGE_SIZE));
        return Math.min(p, maxPage);
      });
      toast({ title: "Oferta excluída" });
      router.refresh();
    } catch {
      toast({ title: "Erro ao excluir oferta", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
      {/* Header */}
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

      {/* Empty state */}
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
        <>
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="divide-y divide-border">
              {paginated.map((o) => (
                <div key={o.id} className="group flex items-center hover:bg-surface-800/40 transition-colors">
                  <Link
                    href={`/ofertas/${o.id}`}
                    className="flex flex-1 items-center gap-4 px-4 py-4 min-w-0"
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

                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 ml-2" />
                  </Link>

                  {/* Delete action — outside Link, in the flex row */}
                  <div className="pr-3 shrink-0">
                    {confirmId === o.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => deleteOffer(o.id)}
                          disabled={deleting === o.id}
                          className="text-[10px] font-medium text-red-400 hover:text-red-300 px-2 py-1 rounded bg-red-500/10 border border-red-500/30 transition-colors whitespace-nowrap"
                        >
                          {deleting === o.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirmar"}
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-1 rounded transition-colors"
                        >
                          Não
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => { e.preventDefault(); setConfirmId(o.id); }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-400"
                        title="Excluir oferta"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Anterior
              </button>
              <span className="text-xs text-muted-foreground">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                Próxima <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
