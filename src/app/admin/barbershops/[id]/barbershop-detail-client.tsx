"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Brain, CreditCard, Users, Calendar, ExternalLink, AlertTriangle } from "lucide-react";

type Shop = {
  id: string; name: string; slug: string; email: string; city: string; state: string;
  createdAt: string; customers: number; appointments: number; stripeCustomerId: string | null;
  memberships: { id: string; role: string; active: boolean; user: { id: string; name: string | null; email: string } }[];
};
type Sub = { planTier: string; status: string; currentPeriodEnd: string; trialEndsAt: string | null; cancelAtPeriodEnd: boolean; aiCreditBalance: number } | null;

const PLAN_COLOR: Record<string, string> = {
  FREE: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
  STARTER: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  PRO: "border-gold-500/30 bg-gold-500/10 text-gold-400",
  ENTERPRISE: "border-purple-500/30 bg-purple-500/10 text-purple-400",
};
const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "border-green-500/30 bg-green-500/10 text-green-400",
  TRIALING: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  PAST_DUE: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
  CANCELED: "border-red-500/30 bg-red-500/10 text-red-400",
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface-800/60 p-5 space-y-4">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </div>
  );
}

export function BarbershopDetailClient({
  shop, subscription, aiUsages, billingThisMonth,
}: {
  shop: Shop;
  subscription: Sub;
  aiUsages: { yearMonth: string; usageCount: number }[];
  billingThisMonth: { amountCents: number; count: number };
}) {
  const router = useRouter();
  const [planTier, setPlanTier]   = useState(subscription?.planTier ?? "FREE");
  const [subStatus, setSubStatus] = useState(subscription?.status   ?? "ACTIVE");
  const [credits,   setCredits]   = useState("");
  const [saving,    setSaving]    = useState(false);
  const [msg,       setMsg]       = useState("");

  async function overridePlan() {
    setSaving(true); setMsg("");
    const res = await fetch(`/api/admin/barbershops/${shop.id}/plan`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planTier, status: subStatus }),
    });
    setSaving(false);
    setMsg(res.ok ? "✅ Plano atualizado!" : "❌ Erro ao salvar");
    if (res.ok) router.refresh();
  }

  async function addCredits() {
    const n = parseInt(credits);
    if (!n || n <= 0) return;
    setSaving(true); setMsg("");
    const res = await fetch(`/api/admin/barbershops/${shop.id}/credits`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credits: n }),
    });
    setSaving(false);
    setMsg(res.ok ? `✅ +${n} créditos adicionados` : "❌ Erro");
    if (res.ok) { setCredits(""); router.refresh(); }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/barbershops">
          <Button size="sm" variant="ghost" className="h-8 px-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">{shop.name}</h1>
          <p className="text-sm text-muted-foreground">{shop.email} · {shop.city}, {shop.state}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Users,    label: "Clientes",      value: shop.customers    },
          { icon: Calendar, label: "Agendamentos",   value: shop.appointments },
          { icon: Brain,    label: "IA (créditos)",  value: subscription?.aiCreditBalance ?? 0 },
          { icon: CreditCard, label: "PRO este mês (R$)", value: `R$ ${((billingThisMonth.amountCents) / 100).toFixed(2)}` },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-lg border border-border bg-surface-800/60 p-4">
            <Icon className="h-4 w-4 text-muted-foreground mb-1" />
            <p className="text-xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Plan override */}
        <Card title="Gerenciar Plano">
          <div className="space-y-3">
            {/* Stripe conflict warning */}
            {subscription?.cancelAtPeriodEnd && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/8 px-3 py-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-amber-400 font-medium">Mudança Stripe pendente</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Há uma alteração agendada via Stripe para {subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString("pt-BR") : "—"}. Override manual pode conflitar. Use o Stripe Dashboard para reverter primeiro.
                  </p>
                </div>
              </div>
            )}
            {subscription?.status === "TRIALING" && subscription.trialEndsAt && (
              <div className="flex items-start gap-2 rounded-md border border-blue-500/20 bg-blue-500/5 px-3 py-2">
                <p className="text-[11px] text-blue-400">
                  Trial ativo — expira em {new Date(subscription.trialEndsAt).toLocaleDateString("pt-BR")}. O cron diário migra automaticamente para FREE após a expiração.
                </p>
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Plano</label>
              <select value={planTier} onChange={(e) => setPlanTier(e.target.value)}
                className="w-full rounded-md border border-border bg-surface-700 px-3 py-2 text-sm text-foreground">
                {["FREE","STARTER","PRO","ENTERPRISE"].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Status</label>
              <select value={subStatus} onChange={(e) => setSubStatus(e.target.value)}
                className="w-full rounded-md border border-border bg-surface-700 px-3 py-2 text-sm text-foreground">
                {["ACTIVE","TRIALING","PAST_DUE","CANCELED","UNPAID","INCOMPLETE"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <Button onClick={overridePlan} disabled={saving} size="sm" className="w-full bg-red-500/80 hover:bg-red-500 text-white">
              {saving ? "Salvando…" : "Aplicar override"}
            </Button>
            {msg && <p className="text-xs text-center">{msg}</p>}
          </div>
        </Card>

        {/* Credits */}
        <Card title="Créditos de IA">
          <p className="text-sm text-muted-foreground">
            Saldo atual: <span className="text-foreground font-semibold">{subscription?.aiCreditBalance ?? 0} créditos</span>
          </p>
          <div className="flex gap-2">
            <Input type="number" min={1} value={credits} onChange={(e) => setCredits(e.target.value)}
              placeholder="Qtd de créditos" className="flex-1" />
            <Button onClick={addCredits} disabled={saving || !credits} size="sm">+ Adicionar</Button>
          </div>

          {/* AI usage history */}
          {aiUsages.length > 0 && (
            <div className="space-y-1 pt-1">
              <p className="text-xs text-muted-foreground font-medium">Histórico de uso</p>
              {aiUsages.map((u) => (
                <div key={u.yearMonth} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{u.yearMonth}</span>
                  <span className="text-foreground">{u.usageCount} calls</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Members */}
      <Card title="Membros">
        <div className="space-y-2">
          {shop.memberships.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">{m.user.name ?? m.user.email}</p>
                <p className="text-xs text-muted-foreground">{m.user.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] border rounded-full px-2 py-0.5 ${m.active ? "border-green-500/30 text-green-400" : "border-red-500/30 text-red-400"}`}>
                  {m.active ? "Ativo" : "Inativo"}
                </span>
                <span className="text-[11px] border border-border rounded-full px-2 py-0.5 text-muted-foreground">{m.role}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Stripe */}
      {shop.stripeCustomerId && (
        <Card title="Stripe">
          <a
            href={`https://dashboard.stripe.com/customers/${shop.stripeCustomerId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Ver cliente no Stripe Dashboard
          </a>
        </Card>
      )}
    </div>
  );
}
