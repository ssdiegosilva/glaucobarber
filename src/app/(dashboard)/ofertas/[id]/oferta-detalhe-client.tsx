"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  Users, Tag, Calendar, Package, Scissors, MessageCircle,
  CheckCircle2, Clock, AlertCircle, ChevronLeft, ChevronRight,
  Image as ImageIcon,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";

type OfferDetail = {
  id: string;
  title: string;
  type: string;
  referenceNames: string[];
  daysInactive: number;
  discount: boolean;
  discountPct: number | null;
  messageTemplate: string;
  mediaImageUrl: string | null;
  customersCount: number;
  status: string;
  createdAt: string;
};

type CustomerRow = {
  id: string;
  customerName: string;
  phone: string;
  message: string;
  whatsappStatus: string | null;
  sentAt: string | null;
  createdAt: string;
};

function StatusBadge({ status }: { status: string | null }) {
  if (status === "SENT") return (
    <span className="flex items-center gap-1 text-[10px] text-green-400 font-medium">
      <CheckCircle2 className="h-3 w-3" /> Enviado
    </span>
  );
  if (status === "FAILED") return (
    <span className="flex items-center gap-1 text-[10px] text-red-400 font-medium">
      <AlertCircle className="h-3 w-3" /> Falhou
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
      <Clock className="h-3 w-3" /> Aguardando
    </span>
  );
}

export function OfertaDetalheClient({
  offer,
  initialCustomers,
  initialTotal,
}: {
  offer: OfferDetail;
  initialCustomers: CustomerRow[];
  initialTotal: number;
}) {
  const [customers, setCustomers] = useState<CustomerRow[]>(initialCustomers);
  const [total]                   = useState(initialTotal);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(false);
  const [expanded, setExpanded]   = useState<string | null>(null);

  const pages = Math.ceil(total / 10);

  async function loadPage(p: number) {
    setLoading(true);
    try {
      const res = await fetch(`/api/targeted-offers/${offer.id}?page=${p}&limit=10`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCustomers(data.customers);
      setPage(p);
    } catch {
      toast({ title: "Erro ao carregar", variant: "destructive" });
    } finally { setLoading(false); }
  }

  function openWhatsApp(phone: string, message: string) {
    const clean = phone.replace(/\D/g, "");
    const full  = clean.startsWith("55") ? clean : `55${clean}`;
    window.open(`https://wa.me/${full}?text=${encodeURIComponent(message)}`, "_blank");
  }

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-5">

      {/* Back */}
      <Link href="/ofertas" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="h-4 w-4" /> Todas as ofertas
      </Link>

      {/* Offer summary card */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            {offer.type === "product" ? <Package className="h-5 w-5 text-primary" /> : <Scissors className="h-5 w-5 text-primary" />}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-foreground">{offer.title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(new Date(offer.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="text-xs px-2.5 py-1 rounded-full bg-surface-800 border border-border text-muted-foreground flex items-center gap-1.5">
            {offer.type === "product" ? <Package className="h-3 w-3" /> : <Scissors className="h-3 w-3" />}
            {offer.referenceNames.join(", ")}
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-surface-800 border border-border text-muted-foreground flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            +{offer.daysInactive} dias sem comprar
          </span>
          {offer.discount && offer.discountPct && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 flex items-center gap-1.5">
              <Tag className="h-3 w-3" />
              {offer.discountPct}% de desconto
            </span>
          )}
          {offer.mediaImageUrl && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center gap-1.5">
              <ImageIcon className="h-3 w-3" />
              Com foto
            </span>
          )}
          <span className="text-xs px-2.5 py-1 rounded-full bg-surface-800 border border-border text-muted-foreground flex items-center gap-1.5">
            <Users className="h-3 w-3" />
            {offer.customersCount} clientes
          </span>
        </div>

        {/* Template preview */}
        <div className="rounded-lg bg-surface-800 border border-border/60 p-3">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Template</p>
          <p className="text-xs text-foreground whitespace-pre-wrap line-clamp-3">{offer.messageTemplate}</p>
        </div>
      </div>

      {/* Customers table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Clientes ({total})
          </p>
          {loading && <span className="text-xs text-muted-foreground">Carregando...</span>}
        </div>

        <div className="rounded-xl border border-border overflow-hidden">
          <div className="divide-y divide-border">
            {customers.map((c) => (
              <div key={c.id} className="space-y-0">
                <button
                  onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-800/40 transition-colors text-left"
                >
                  <div className="h-8 w-8 rounded-full bg-surface-800 border border-border flex items-center justify-center shrink-0">
                    <span className="text-xs font-semibold text-foreground">{c.customerName.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{c.customerName}</p>
                    <p className="text-xs text-muted-foreground">{c.phone}</p>
                  </div>
                  <StatusBadge status={c.whatsappStatus} />
                  <button
                    onClick={(e) => { e.stopPropagation(); openWhatsApp(c.phone, c.message); }}
                    className="h-8 w-8 rounded-lg border border-green-500/30 bg-green-500/10 flex items-center justify-center hover:bg-green-500/20 transition-colors shrink-0"
                    title="Abrir WhatsApp"
                  >
                    <MessageCircle className="h-4 w-4 text-green-400" />
                  </button>
                </button>

                {/* Expanded message */}
                {expanded === c.id && (
                  <div className="px-4 pb-3 pt-0">
                    <div className="rounded-lg bg-surface-800 border border-border/60 p-3">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Mensagem personalizada</p>
                      <p className="text-xs text-foreground whitespace-pre-wrap">{c.message}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadPage(page - 1)}
              disabled={page <= 1 || loading}
              className="gap-1.5"
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>
            <span className="text-xs text-muted-foreground">{page} de {pages}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadPage(page + 1)}
              disabled={page >= pages || loading}
              className="gap-1.5"
            >
              Próxima <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
