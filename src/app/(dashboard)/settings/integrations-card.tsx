"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Scissors, Instagram, MessageCircle, CheckCircle2, CircleDashed, Unplug } from "lucide-react";

interface Props {
  trinks:    { connected: boolean };
  instagram: { connected: boolean; username?: string | null };
  whatsapp:  { connected: boolean; phoneNumberId?: string | null };
}

type Provider = "trinks" | "instagram" | "whatsapp";

export function IntegrationsCard({ trinks, instagram, whatsapp }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<Provider | null>(null);
  const [confirm, setConfirm] = useState<Provider | null>(null);

  async function disconnect(provider: Provider) {
    setLoading(provider);
    try {
      const res = await fetch("/api/integrations/disconnect", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ provider }),
      });
      if (res.ok) {
        setConfirm(null);
        router.refresh();
      }
    } finally {
      setLoading(null);
    }
  }

  const items = [
    {
      key:       "trinks" as Provider,
      label:     "Trinks",
      sublabel:  trinks.connected ? "Conectado — fonte de dados principal" : "Não conectado",
      icon:      Scissors,
      connected: trinks.connected,
      detail:    null,
    },
    {
      key:       "instagram" as Provider,
      label:     "Instagram",
      sublabel:  instagram.connected
        ? instagram.username ? `@${instagram.username}` : "Conectado"
        : "Não conectado",
      icon:      Instagram,
      connected: instagram.connected,
      detail:    null,
    },
    {
      key:       "whatsapp" as Provider,
      label:     "WhatsApp Business",
      sublabel:  whatsapp.connected
        ? whatsapp.phoneNumberId ? `ID: ${whatsapp.phoneNumberId}` : "Conectado"
        : "Não conectado",
      icon:      MessageCircle,
      connected: whatsapp.connected,
      detail:    null,
    },
  ];

  return (
    <div className="rounded-xl border border-border/60 bg-surface-900 overflow-hidden">
      <div className="px-5 py-4 border-b border-border/40">
        <p className="text-sm font-medium text-foreground">Integrações</p>
        <p className="text-xs text-muted-foreground mt-0.5">Gerencie as conexões com serviços externos</p>
      </div>

      <div className="divide-y divide-border/30">
        {items.map(({ key, label, sublabel, icon: Icon, connected }) => (
          <div key={key} className="flex items-center justify-between px-5 py-4 gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                connected
                  ? "border-emerald-500/30 bg-emerald-500/8 text-emerald-400"
                  : "border-border/60 bg-surface-800 text-muted-foreground/50"
              }`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  {connected
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    : <CircleDashed className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                  }
                </div>
                <p className="text-xs text-muted-foreground truncate">{sublabel}</p>
              </div>
            </div>

            {connected && (
              confirm === key ? (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">Confirmar?</span>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs px-3"
                    disabled={loading === key}
                    onClick={() => disconnect(key)}
                  >
                    {loading === key ? "…" : "Sim"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs px-2"
                    onClick={() => setConfirm(null)}
                  >
                    Não
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 h-7 text-xs gap-1.5 text-muted-foreground hover:text-red-400 hover:border-red-400/30"
                  onClick={() => setConfirm(key)}
                >
                  <Unplug className="h-3.5 w-3.5" />
                  Desconectar
                </Button>
              )
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
