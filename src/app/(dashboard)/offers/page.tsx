import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBRL, formatDate } from "@/lib/utils";
import { Tag, Plus, Package, Crown, Zap } from "lucide-react";

const TYPE_LABEL = {
  PACKAGE:      "Pacote",
  COMBO:        "Combo",
  SUBSCRIPTION: "Assinatura VIP",
  FLASH_PROMO:  "Promoção Relâmpago",
  PREPAID:      "Crédito Pré-pago",
};
const TYPE_ICON = {
  PACKAGE:      Package,
  COMBO:        Tag,
  SUBSCRIPTION: Crown,
  FLASH_PROMO:  Zap,
  PREPAID:      Tag,
};
const STATUS_VARIANT = { ACTIVE: "success", DRAFT: "outline", PAUSED: "warning", EXPIRED: "destructive", ARCHIVED: "secondary" } as const;
const STATUS_LABEL   = { ACTIVE: "Ativa", DRAFT: "Rascunho", PAUSED: "Pausada", EXPIRED: "Expirada", ARCHIVED: "Arquivada" };

export default async function OffersPage() {
  const session = await auth();
  if (!session?.user?.barbershopId) redirect("/onboarding");

  const offers = await prisma.offer.findMany({
    where:   { barbershopId: session.user.barbershopId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Ofertas & Pacotes"
        subtitle="Crie pacotes, combos e assinaturas para seus clientes"
        userName={session.user.name}
        actions={
          <Button size="sm" className="h-8 text-xs">
            <Plus className="h-3.5 w-3.5" />
            Nova Oferta
          </Button>
        }
      />

      <div className="p-6 space-y-4">
        {offers.length === 0 ? (
          <EmptyOffers />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {offers.map((o) => {
              const Icon = TYPE_ICON[o.type] ?? Tag;
              const discount = Math.round((1 - Number(o.salePrice) / Number(o.originalPrice)) * 100);
              return (
                <div key={o.id} className="rounded-lg border border-border bg-card p-5 hover:border-gold-500/30 transition-colors">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold-500/10 border border-gold-500/20">
                      <Icon className="h-5 w-5 text-gold-400" />
                    </div>
                    <div className="flex gap-1.5">
                      <Badge variant={STATUS_VARIANT[o.status] as never} className="text-[10px]">
                        {STATUS_LABEL[o.status]}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">{TYPE_LABEL[o.type]}</Badge>
                    </div>
                  </div>

                  <h3 className="font-semibold text-foreground">{o.title}</h3>
                  {o.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{o.description}</p>}

                  <div className="flex items-center gap-3 mt-4">
                    <p className="text-xl font-bold text-gold-400">{formatBRL(Number(o.salePrice))}</p>
                    {discount > 0 && (
                      <>
                        <p className="text-xs text-muted-foreground line-through">{formatBRL(Number(o.originalPrice))}</p>
                        <Badge variant="success" className="text-[10px]">-{discount}%</Badge>
                      </>
                    )}
                  </div>

                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                    {o.credits && <span>{o.credits} sessões</span>}
                    {o.validUntil && <span>Até {formatDate(o.validUntil)}</span>}
                    {o.maxRedemptions && (
                      <span>{o.redemptionsCount}/{o.maxRedemptions} resgates</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyOffers() {
  return (
    <div className="rounded-xl border border-dashed border-gold-500/20 bg-card p-12 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gold-500/10">
        <Tag className="h-6 w-6 text-gold-400" />
      </div>
      <h3 className="font-semibold text-foreground mb-2">Nenhuma oferta criada</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
        Crie pacotes antecipados, combos ou assinaturas VIP para fidelizar clientes e garantir receita.
      </p>
      <Button size="sm">
        <Plus className="h-3.5 w-3.5" />
        Criar primeira oferta
      </Button>
    </div>
  );
}
