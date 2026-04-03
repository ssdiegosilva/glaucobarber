# GlaucoBarber — Contexto do Projeto

## O que é

SaaS multi-tenant para barbearias. Cada barbearia tem seus próprios dados, usuários e configurações.

**Filosofia**: Trinks = backend operacional (agenda, clientes, serviços). Este app = camada de inteligência por cima (IA, campanhas, WhatsApp, financeiro).

**Deploy**: Vercel + Supabase (PostgreSQL + Storage). Domínio: glaucobarber.com

---

## Stack

- **Framework**: Next.js 15 App Router, TypeScript, Tailwind CSS
- **Banco**: PostgreSQL via Prisma (Supabase). Schema em `prisma/schema.prisma`
- **Auth**: NextAuth (`src/lib/auth.ts`) — sessão tem `user.barbershopId`
- **IA**: OpenAI (`src/lib/ai/openai.ts`) — GPT-4o-mini para texto, gpt-image-1 para imagens
- **Storage**: Supabase Storage (`src/lib/storage.ts`) — bucket `campaign-images`
- **Pagamentos**: Stripe (`src/lib/stripe.ts`) — planos FREE / STARTER / PRO / ENTERPRISE
- **WhatsApp**: Meta Cloud API (`src/lib/whatsapp.ts`)

---

## Estrutura de pastas relevante

```
src/
  app/
    (dashboard)/          # Páginas autenticadas
      agenda/             # Agenda do dia
      campaigns/          # Campanhas de marketing com IA
      clientes/           # CRM de clientes
      copilot/            # CEO Copilot (chat com IA)
      financeiro/         # Financeiro mensal/anual
      meta/               # Metas financeiras
      billing/            # Plano e fatura (SaaS)
      settings/           # Configurações da barbearia
      whatsapp/           # Gestão de WhatsApp
    api/                  # API Routes (Next.js)
      barbershop/         # PATCH dados da barbearia
      billing/            # Plano, statement
      campaigns/          # CRUD campanhas + geração IA
      copilot/            # Chat do copilot
      settings/           # brand-style, etc.
      whatsapp/           # Mensagens, templates, bot
  lib/
    ai/
      types.ts            # Interface AIProvider
      openai.ts           # Implementação OpenAI
      provider.ts         # getAIProvider()
    billing.ts            # getPlan, hasFeature, consumeAiCredit
    auth.ts               # NextAuth config
    prisma.ts             # Prisma client singleton
    storage.ts            # Upload Supabase Storage
    whatsapp.ts           # Envio via Meta API
  components/
    layout/               # Header, Sidebar
    ui/                   # shadcn/ui components
    billing/              # UpgradeWall
```

---

## Modelo de dados (principais)

- **Barbershop**: tenant principal. Tem `brandStyle` (estilo visual para IA) e `campaignReferenceImageUrl` (foto de referência para campanhas)
- **Membership**: usuário ↔ barbearia (role: OWNER/STAFF)
- **Customer**: clientes com `lastWhatsappSentAt`, `lastAppointmentAt`
- **Appointment**: agendamentos sincronizados do Trinks
- **Campaign**: campanhas com `text`, `artBriefing`, `imageUrl`, `status` (DRAFT/APPROVED/DISMISSED/SCHEDULED/PUBLISHED)
- **WhatsappMessage**: fila de mensagens com `status` (QUEUED/SENT/FAILED) e `sentManually`
- **WhatsappTemplate**: templates sincronizados da Meta via WABA ID
- **BillingEvent**: cobrança por atendimento (plano PRO)
- **CopilotThread / CopilotMessage**: histórico do chat com IA (máx 20 mensagens por thread)
- **PlatformSubscription**: plano SaaS por barbearia

---

## Planos

| Tier | IA/período | Features bloqueadas |
|---|---|---|
| FREE | 30 (trial) | financeiro, meta, whatsapp_auto |
| STARTER | 50/mês | financeiro, whatsapp_auto |
| PRO | 300/mês | — (todas liberadas) |
| ENTERPRISE | ilimitado | — |

Durante TRIALING → `effectiveTier = PRO` (acesso total).

---

## Padrões de código

- **Páginas**: server component busca dados, passa como props para client component
- **Layout**: todas as páginas usam `<div className="flex flex-col h-full">` como wrapper
- **Header**: `<Header title="..." subtitle="..." userName={session.user.name} />`
- **Queries AI**: sempre verificar `checkAiAllowance` antes, `consumeAiCredit` depois
- **Schema changes**: rodar `npx prisma db push` (node via `~/.nvm/versions/node/v20.20.2/bin/npx`)
- **TypeScript check**: `npx tsc --noEmit` filtrar com `| grep -v "\.next/types"`

---

## Geração de imagens

- Sempre usa `gpt-image-1` (retorna `b64_json`)
- Com `campaignReferenceImageUrl`: usa `images.edit` (foto do barbeiro como base)
- Sem referência: usa `images.generate`
- Fallback automático para `dall-e-3` (retorna URL) se `gpt-image-1` falhar
- Os routes tratam os dois casos: `"b64" in img` → `uploadCampaignImage`, senão `uploadCampaignImageFromUrl`

---

## WhatsApp

- Configuração em 2 etapas: (1) Access Token + Phone Number ID, (2) WABA ID (separado, pós-setup)
- Botão "Enviar com bot" só aparece se `hasAutoSend && whatsappConfigured && hasWabaId`
- Mensagem personalizada (wa.me) → cria direto com `status: SENT`, não vai para fila
- Templates sincronizados via `POST /api/whatsapp/templates/sync`

---

## Convenções importantes

- `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"` antes de rodar npx/node
- Banco: Supabase PostgreSQL em `aws-1-us-east-1.pooler.supabase.com`
- Imagens de campanha vão para bucket `campaign-images` no Supabase Storage
- Copilot limita a 20 mensagens por thread (apaga as mais antigas)
