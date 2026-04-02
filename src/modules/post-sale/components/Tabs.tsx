"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type React from "react";

export function PostSaleTabs({
  defaultTab,
  children,
}: {
  defaultTab?: string;
  children: React.ReactNode;
}) {
  return (
    <Tabs defaultValue={defaultTab ?? "overview"} className="w-full">
      <TabsList className="grid grid-cols-3 md:grid-cols-6 gap-2">
        <TabsTrigger value="overview">Visão Geral</TabsTrigger>
        <TabsTrigger value="risk">Em risco</TabsTrigger>
        <TabsTrigger value="reviews">Avaliações Google</TabsTrigger>
        <TabsTrigger value="recent">Recém-atendidos</TabsTrigger>
        <TabsTrigger value="followups">Acompanhamentos</TabsTrigger>
        <TabsTrigger value="inactive">Inativos</TabsTrigger>
      </TabsList>
      {children}
    </Tabs>
  );
}

export { TabsContent };
