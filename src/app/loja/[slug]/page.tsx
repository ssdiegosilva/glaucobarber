import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const shop = await prisma.barbershop.findUnique({
    where: { slug },
    select: { name: true, logoUrl: true },
  });
  if (!shop) return { title: "Não encontrado" };
  return {
    title: `${shop.name} — Produtos`,
    description: `Confira os produtos de ${shop.name}`,
    openGraph: {
      title: `${shop.name} — Produtos`,
      description: `Confira os produtos de ${shop.name}`,
      ...(shop.logoUrl ? { images: [{ url: shop.logoUrl }] } : {}),
    },
  };
}

export default async function LojaPage({ params }: Props) {
  const { slug } = await params;

  const shop = await prisma.barbershop.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      segment: { select: { colorPrimary: true, colorBackground: true, colorCard: true } },
    },
  });
  if (!shop) notFound();

  const products = await prisma.product.findMany({
    where: { barbershopId: shop.id, active: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  const accent = shop.segment?.colorPrimary ?? "43 74% 49%";

  return (
    <div className="min-h-screen bg-[#080810] text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-5">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          {shop.logoUrl ? (
            <Image src={shop.logoUrl} alt={shop.name} width={40} height={40} className="h-10 w-10 rounded-xl object-cover" />
          ) : (
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center text-lg font-bold"
              style={{ background: `hsl(${accent} / 0.15)`, color: `hsl(${accent})` }}
            >
              {shop.name.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold">{shop.name}</h1>
            <p className="text-xs text-white/50">Catálogo de produtos</p>
          </div>
        </div>
      </header>

      {/* Products grid */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {products.length === 0 ? (
          <p className="text-center text-white/40 py-20 text-sm">Nenhum produto disponível no momento.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {products.map((p) => (
              <Link
                key={p.id}
                href={`/loja/${slug}/p/${p.id}`}
                className="group rounded-xl border border-white/10 bg-white/5 overflow-hidden hover:border-white/20 transition-all"
              >
                {p.imageUrl ? (
                  <div className="aspect-square relative">
                    <Image src={p.imageUrl} alt={p.name} fill className="object-cover group-hover:scale-105 transition-transform" />
                  </div>
                ) : (
                  <div
                    className="aspect-square flex items-center justify-center text-3xl font-bold"
                    style={{ background: `hsl(${accent} / 0.08)`, color: `hsl(${accent} / 0.3)` }}
                  >
                    {p.name.charAt(0)}
                  </div>
                )}
                <div className="p-3">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  {p.category && (
                    <p className="text-[10px] text-white/40 mt-0.5">{p.category}</p>
                  )}
                  <p className="text-sm font-bold mt-1" style={{ color: `hsl(${accent})` }}>
                    {Number(p.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 text-center">
        <p className="text-xs text-white/30">Powered by Voltaki</p>
      </footer>
    </div>
  );
}
