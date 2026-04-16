import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string; id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, id } = await params;
  const shop = await prisma.barbershop.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (!shop) return { title: "Não encontrado" };

  const product = await prisma.product.findFirst({
    where: { id, barbershopId: shop.id, active: true },
  });
  if (!product) return { title: "Produto não encontrado" };

  const price = Number(product.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const title = `${product.name} — ${price}`;
  const description = product.description
    ? `${product.description} | ${shop.name}`
    : `${product.name} por ${price} em ${shop.name}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: shop.name,
      ...(product.imageUrl ? { images: [{ url: product.imageUrl, width: 600, height: 600, alt: product.name }] } : {}),
    },
    twitter: {
      card: product.imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      ...(product.imageUrl ? { images: [product.imageUrl] } : {}),
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug, id } = await params;

  const shop = await prisma.barbershop.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      phone: true,
      segment: { select: { colorPrimary: true } },
    },
  });
  if (!shop) notFound();

  const product = await prisma.product.findFirst({
    where: { id, barbershopId: shop.id, active: true },
  });
  if (!product) notFound();

  const accent = shop.segment?.colorPrimary ?? "43 74% 49%";
  const price = Number(product.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // WhatsApp link to contact the shop
  const whatsappLink = shop.phone
    ? `https://wa.me/${shop.phone.replace(/\D/g, "").replace(/^(?!55)/, "55")}?text=${encodeURIComponent(`Olá! Vi o produto "${product.name}" no catálogo e gostaria de saber mais.`)}`
    : null;

  return (
    <div className="min-h-screen bg-[#080810] text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href={`/loja/${slug}`} className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors">
            <ChevronLeft className="h-4 w-4" />
            {shop.name}
          </Link>
        </div>
      </header>

      {/* Product */}
      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          {/* Image */}
          {product.imageUrl ? (
            <div className="relative aspect-square max-h-[400px] w-full">
              <Image src={product.imageUrl} alt={product.name} fill className="object-cover" priority />
            </div>
          ) : (
            <div
              className="aspect-video flex items-center justify-center text-6xl font-bold"
              style={{ background: `hsl(${accent} / 0.08)`, color: `hsl(${accent} / 0.2)` }}
            >
              {product.name.charAt(0)}
            </div>
          )}

          {/* Details */}
          <div className="p-5 space-y-3">
            {product.category && (
              <span className="text-[10px] uppercase tracking-widest text-white/40">{product.category}</span>
            )}
            <h1 className="text-xl font-bold">{product.name}</h1>
            {product.description && (
              <p className="text-sm text-white/60 leading-relaxed">{product.description}</p>
            )}
            <p className="text-2xl font-bold" style={{ color: `hsl(${accent})` }}>{price}</p>

            {/* CTA */}
            {whatsappLink && (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex items-center justify-center gap-2 rounded-xl py-3 px-6 text-sm font-semibold text-white transition-colors"
                style={{ background: `hsl(${accent})` }}
              >
                Perguntar no WhatsApp
              </a>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 text-center">
        <Link href={`/loja/${slug}`} className="text-xs text-white/30 hover:text-white/50 transition-colors">
          Ver todos os produtos de {shop.name}
        </Link>
      </footer>
    </div>
  );
}
