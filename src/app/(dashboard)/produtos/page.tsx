import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { ProdutosClient } from "./produtos-client";

export default async function ProdutosPage() {
  const session = await auth();
  if (!session?.user?.barbershopId) redirect("/login");

  const barbershopId = session.user.barbershopId;

  const products = await prisma.product.findMany({
    where: { barbershopId, deletedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, price: true, category: true,
      description: true, active: true, imageUrl: true, createdAt: true,
    },
  });

  const serialized = products.map((p) => ({
    ...p,
    price: Number(p.price),
    createdAt: p.createdAt.toISOString(),
  }));

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Produtos"
        subtitle={`${products.length} produto${products.length !== 1 ? "s" : ""} cadastrado${products.length !== 1 ? "s" : ""}`}
        userName={session.user.name ?? ""}
      />
      <ProdutosClient initialProducts={serialized} />
    </div>
  );
}
