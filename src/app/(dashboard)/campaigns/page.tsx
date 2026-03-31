import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { relativeTime } from "@/lib/utils";
import { Megaphone, CheckCircle2, Clock, XCircle, Send } from "lucide-react";

const STATUS_LABEL   = { DRAFT: "Rascunho", APPROVED: "Aprovada", DISMISSED: "Dispensada", SCHEDULED: "Agendada", PUBLISHED: "Publicada" };
const STATUS_VARIANT = { DRAFT: "outline", APPROVED: "default", DISMISSED: "secondary", SCHEDULED: "info", PUBLISHED: "success" } as const;
const STATUS_ICON = {
  DRAFT:     <Clock className="h-3 w-3" />,
  APPROVED:  <CheckCircle2 className="h-3 w-3" />,
  DISMISSED: <XCircle className="h-3 w-3" />,
  SCHEDULED: <Clock className="h-3 w-3" />,
  PUBLISHED: <Send className="h-3 w-3" />,
};

export default async function CampaignsPage() {
  const session = await auth();
  if (!session?.user?.barbershopId) redirect("/onboarding");

  const campaigns = await prisma.campaign.findMany({
    where:   { barbershopId: session.user.barbershopId },
    orderBy: { createdAt: "desc" },
    include: { suggestion: { select: { type: true } } },
  });

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Campanhas"
        subtitle="Histórico e aprovações de campanhas geradas pela IA"
        userName={session.user.name}
      />

      <div className="p-6 space-y-4">
        {campaigns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gold-500/20 bg-card p-12 text-center">
            <Megaphone className="h-8 w-8 text-gold-400/50 mx-auto mb-3" />
            <h3 className="font-semibold text-foreground mb-1">Nenhuma campanha ainda</h3>
            <p className="text-sm text-muted-foreground">
              As campanhas são criadas pela IA com base no contexto da sua barbearia.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {campaigns.map((c) => (
              <Card key={c.id} className={c.status === "APPROVED" ? "border-gold-500/25" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-sm leading-snug">{c.title}</CardTitle>
                    <Badge variant={STATUS_VARIANT[c.status] as never} className="shrink-0 flex items-center gap-1">
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
                    <p className="text-xs text-foreground/80 leading-relaxed">{c.text}</p>
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
                    {c.status === "APPROVED" && (
                      <Button size="sm" variant="outline" className="h-6 text-[10px] px-2">
                        <Send className="h-2.5 w-2.5 mr-1" />
                        Publicar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
