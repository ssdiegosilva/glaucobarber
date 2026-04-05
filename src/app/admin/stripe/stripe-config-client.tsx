"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreditCard, ExternalLink, Save, Percent } from "lucide-react";

const PRICE_FIELDS = [
  { key: "stripe_price_starter_monthly",    label: "Price ID — Starter (R$89/mês)",       hint: "price_..." },
  { key: "stripe_price_pro_monthly",        label: "Price ID — Pro (R$149/mês)",           hint: "price_..." },
  { key: "stripe_price_pro_metered",        label: "Price ID — Pro Metered (por atendimento)", hint: "price_..." },
  { key: "stripe_price_enterprise_monthly", label: "Price ID — Enterprise (custom)",       hint: "price_..." },
  { key: "stripe_price_ai_credits_pack",    label: "Price ID — Pacote IA (R$20 único, +200 chamadas)", hint: "price_..." },
] as const;

const FEE_FIELDS = [
  { key: "pro_appointment_fee_cents",     label: "Taxa por atendimento PRO (em centavos)", hint: "100  →  R$1,00" },
  { key: "pro_appointment_fee_cap_cents", label: "Cap mensal de taxas PRO (em centavos)",  hint: "40000  →  R$400,00" },
] as const;

export function StripeConfigClient({ current }: { current: Record<string, string> }) {
  const [values, setValues] = useState<Record<string, string>>({ ...current });
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState("");

  async function save() {
    setSaving(true); setMsg("");
    const res = await fetch("/api/admin/stripe-config", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(values),
    });
    setSaving(false);
    setMsg(res.ok ? "✅ Configurações salvas!" : "❌ Erro ao salvar");
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-foreground">Configuração Stripe</h1>
        <p className="text-sm text-muted-foreground">Price IDs salvos no banco — sem precisar de redeploy.</p>
      </div>

      <a
        href="https://dashboard.stripe.com/products"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Abrir Stripe Dashboard → Produtos
      </a>

      <div className="rounded-lg border border-border bg-surface-800/60 p-5 space-y-4">
        <div className="flex items-center gap-2 pb-1">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Price IDs</span>
        </div>

        {PRICE_FIELDS.map(({ key, label, hint }) => (
          <div key={key} className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{label}</label>
            <Input
              value={values[key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              placeholder={hint}
              className="font-mono text-sm"
            />
          </div>
        ))}

        <div className="flex items-center gap-3 pt-2">
          <Button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 bg-red-500/80 hover:bg-red-500 text-white">
            <Save className="h-4 w-4" />
            {saving ? "Salvando…" : "Salvar configurações"}
          </Button>
          {msg && <span className="text-sm">{msg}</span>}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface-800/60 p-5 space-y-4">
        <div className="flex items-center gap-2 pb-1">
          <Percent className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Tarifas PRO por atendimento</span>
        </div>

        {FEE_FIELDS.map(({ key, label, hint }) => (
          <div key={key} className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{label}</label>
            <Input
              value={values[key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              placeholder={hint}
              className="font-mono text-sm"
              type="number"
              min={0}
            />
          </div>
        ))}

        <p className="text-[11px] text-muted-foreground">
          Deixe em branco para usar os valores padrão do código (R$1,00 por atendimento, cap R$400/mês).
          Alterações entram em vigor imediatamente nos próximos atendimentos concluídos.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface-800/40 p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground text-sm">Como obter os Price IDs</p>
        <p>1. Acesse o Stripe Dashboard → <strong>Produtos</strong></p>
        <p>2. Crie um produto para cada plano (Starter R$89/mês, Pro R$149/mês, etc.)</p>
        <p>3. Dentro de cada produto, copie o <strong>Price ID</strong> (começa com <code>price_</code>)</p>
        <p>4. Cole aqui e salve — o sistema passa a usar esses IDs automaticamente</p>
        <p className="pt-1">Para o webhook funcionar, configure no Stripe: <code>https://glaucobarber.com/api/stripe/webhook</code></p>
        <p>Eventos: <code>checkout.session.completed</code>, <code>customer.subscription.updated</code>, <code>customer.subscription.deleted</code>, <code>invoice.payment_failed</code></p>
      </div>
    </div>
  );
}
