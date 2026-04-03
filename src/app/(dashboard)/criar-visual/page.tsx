import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import CriarVisualClient from "./criar-visual-client";

export default async function CriarVisualPage() {
  const session = await auth();
  if (!session?.user?.barbershopId) redirect("/onboarding");

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Criar Visual"
        subtitle="Envie a foto do cliente e a IA sugere e gera o corte ideal"
        userName={session.user.name}
      />
      <CriarVisualClient />
    </div>
  );
}
