"use client";

import { useState } from "react";
import type React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { relativeTime } from "@/lib/utils";
import { CheckCircle2, Clock, Megaphone, Send, XCircle } from "lucide-react";

const STATUS_LABEL: Record<string, string> = { DRAFT: "Rascunho", APPROVED: "Aprovada", DISMISSED: "Dispensada", SCHEDULED: "Agendada", PUBLISHED: "Publicada" };
const STATUS_VARIANT: Record<string, string> = { DRAFT: "outline", APPROVED: "default", DISMISSED: "secondary", SCHEDULED: "info", PUBLISHED: "success" };
const STATUS_ICON: Record<string, React.ReactElement> = {
  DRAFT: <Clock className="h-3 w-3" />,
  APPROVED: <CheckCircle2 className="h-3 w-3" />,
  DISMISSED: <XCircle className="h-3 w-3" />,
  SCHEDULED: <Clock className="h-3 w-3" />,
  PUBLISHED: <Send className="h-3 w-3" />,
};

export interface CampaignDto {
  id: string;
  title: string;
  objective: string;
  text: string;
  artBriefing: string | null;
  status: string;
  channel: string | null;
  createdAt: string | Date;
  imageUrl: string | null;
  templateId: string | null;
}
export interface TemplateDto {
  id: string;
  name: string;
  type: string;
  imageUrl: string;
}

export function CampaignsClient({ campaigns: initial, templates, instagramConfigured }: {
  campaigns: CampaignDto[];
  templates: TemplateDto[];
  instagramConfigured: boolean;
}) {
  const [campaigns, setCampaigns] = useState<CampaignDto[]>(initial);
  const [theme, setTheme] = useState("");
  const [objective, setObjective] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  async function createCampaign() {
    setLoadingCreate(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme, objective, templateId: templateId || undefined, channel: "instagram" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao criar campanha");
      setCampaigns([data.campaign, ...campaigns]);
      setTheme("");
      setObjective("");
      setTemplateId("");
      toast({ title: "Campanha criada", description: "Rascunho gerado pela IA" });
    } catch (e) {
      toast({ title: "Erro", description: String(e), variant: "destructive" });
    } finally {
      setLoadingCreate(false);
    }
  }

  async function setStatus(id: string, status: string) {
    const res = await fetch(`/api/campaigns/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    const data = await res.json();
    if (!res.ok) { toast({ title: "Erro", description: data.error ?? "Não foi possível atualizar" }); return; }
    setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
  }

  async function publish(id: string) {
    setPublishingId(id);
    try {
      const res = await fetch(`/api/campaigns/${id}/publish`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao publicar");
      setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, status: "PUBLISHED" } : c)));
      toast({ title: "Publicado", description: "Campanha enviada ao Instagram" });
    } catch (e) {
      toast({ title: "Erro ao publicar", description: String(e), variant: "destructive" });
    } finally {
      setPublishingId(null);
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { toast({ title: "Erro", description: data.error ?? "Não foi possível deletar" }); return; }
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="space-y-4">
      <Card className="border-dashed border-gold-500/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Megaphone className="h-4 w-4 text-gold-400" /> Nova campanha manual</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Tema</label>
            <input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="Ex: Tarde cheia" className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-xs" />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-[11px] text-muted-foreground">Objetivo</label>
            <input value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Ex: Preencher buracos das 14h-16h" className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-xs" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Template de arte</label>
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-xs">
              <option value="">Selecionar (opcional)</option>
              {templates.map((t) => (<option key={t.id} value={t.id}>{t.name} ({t.type})</option>))}
            </select>
          </div>
          <div className="flex items-end">
            <Button size="sm" onClick={createCampaign} disabled={!theme || !objective || loadingCreate} className="text-xs">
              {loadingCreate ? "Gerando..." : "Gerar com IA"}
            </Button>
          </div>
          {!instagramConfigured && (
            <p className="text-[11px] text-amber-300 md:col-span-2">Para publicar, conecte o Instagram em Integrações.</p>
          )}
        </CardContent>
      </Card>

      {campaigns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gold-500/20 bg-card p-12 text-center">
          <Megaphone className="h-8 w-8 text-gold-400/50 mx-auto mb-3" />
          <h3 className="font-semibold text-foreground mb-1">Nenhuma campanha ainda</h3>
          <p className="text-sm text-muted-foreground">Crie uma campanha manual ou aprove uma sugestão da IA.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {campaigns.map((c) => (
            <Card key={c.id} className={c.status === "APPROVED" ? "border-gold-500/25" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-sm leading-snug">{c.title}</CardTitle>
                  <Badge variant={STATUS_VARIANT[c.status] as any} className="shrink-0 flex items-center gap-1">
                    {STATUS_ICON[c.status]}
                    {STATUS_LABEL[c.status]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Objetivo</p>
                  <p className="text-xs text-foreground/80">{c.objective}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Copy</p>
                  <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">{c.text}</p>
                </div>
                {c.artBriefing && (
                  <div className="rounded-md bg-surface-800 p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Briefing da arte</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{c.artBriefing}</p>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    {c.channel && <Badge variant="outline" className="text-[10px]">{c.channel}</Badge>}
                    <span className="text-[10px] text-muted-foreground">{relativeTime(c.createdAt)}</span>
                  </div>
                  <div className="flex gap-2">
                    {c.status === "DRAFT" && (
                      <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setStatus(c.id, "APPROVED")}>Aprovar</Button>
                    )}
                    {c.status === "APPROVED" && (
                      <Button size="sm" variant="default" className="h-7 text-[11px]" onClick={() => publish(c.id)} disabled={!instagramConfigured || publishingId === c.id}>
                        {publishingId === c.id ? "Publicando..." : "Publicar"}
                      </Button>
                    )}
                    {c.status !== "PUBLISHED" && (
                      <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => remove(c.id)}>Deletar</Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
