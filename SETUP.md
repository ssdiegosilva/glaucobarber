# GlaucoBarber — Setup & Deploy

## Visão geral

```
Trinks (agenda / clientes / serviços)
       ↓ sync via adapter
GlaucoBarber (inteligência / IA / automação / billing)
       ↓ deploy
Vercel + PostgreSQL (Neon / Supabase / Railway)
```

---

## 1. Pré-requisitos

- Node.js 20+
- PostgreSQL (local ou cloud)
- Conta Stripe
- API key Anthropic
- Conta Vercel

---

## 2. Setup local

```bash
# 1. Clone e instale
git clone <repo>
cd glaucobarber
npm install

# 2. Configure ambiente
cp .env.example .env
# Edite .env com seus valores reais

# 3. Database
npm run db:push       # aplica schema
npm run db:seed       # popula dados demo

# 4. Dev
npm run dev
```

Abra: http://localhost:3000

**Login demo (Supabase magic link):**
- Email: `glauco@artshave.com.br`
- Envie o link na página de login; em dev use o link que aparece no terminal (`npm run dev`)

---

## 3. Variáveis de ambiente necessárias

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Secret para NextAuth (gere com `openssl rand -base64 32`) |
| `STRIPE_SECRET_KEY` | Chave secreta Stripe |
| `STRIPE_PUBLISHABLE_KEY` | Chave pública Stripe |
| `STRIPE_WEBHOOK_SECRET` | Secret do webhook Stripe |
| `STRIPE_PRICE_STARTER_MONTHLY` | Price ID do plano Starter |
| `STRIPE_PRICE_PRO_MONTHLY` | Price ID do plano Pro |
| `STRIPE_PRICE_ENTERPRISE_MONTHLY` | Price ID do plano Enterprise |
| `ANTHROPIC_API_KEY` | API key Anthropic |
| `CRON_SECRET` | Secret para proteger rota cron |
| `NEXT_PUBLIC_APP_URL` | URL pública do app |

---

## 4. Setup Stripe

### 4.1. Criar produtos e preços

No dashboard Stripe, crie 3 produtos:
- **Starter** → R$97/mês
- **Pro** → R$197/mês
- **Enterprise** → R$397/mês

Copie os Price IDs para o `.env`.

### 4.2. Webhook

```bash
# Em dev, use Stripe CLI:
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Em produção, configure no dashboard:
# Endpoint: https://glaucobarber.com/api/stripe/webhook
# Eventos: checkout.session.completed, customer.subscription.updated,
#          customer.subscription.deleted, invoice.payment_failed
```

---

## 5. Integração Trinks

**A Trinks é o backend operacional principal.** Este sistema lê dados dela e adiciona inteligência.

### Como configurar

1. Obtenha suas credenciais de API com a Trinks
2. Acesse **Integrações** no painel
3. As credenciais são armazenadas criptografadas no banco

### O que é sincronizado

| Dado | Direção | Frequência |
|---|---|---|
| Clientes | Trinks → App | Manual / diário |
| Serviços | Trinks → App | Manual |
| Agendamentos | Trinks → App | Manual / diário |

### Adaptação

Os arquivos de integração estão em:
```
src/lib/integrations/trinks/
├── client.ts    # HTTP client (ajuste endpoints)
├── types.ts     # Contratos de tipo (ajuste campos)
├── mappers.ts   # Transformações Trinks → DB
└── sync.ts      # Engine de sincronização
```

Campos marcados `[VERIFY]` precisam de confirmação contra a API real da Trinks.

---

## 6. Deploy na Vercel

### 6.1. Push para GitHub

```bash
git add .
git commit -m "chore: initial project"
git push origin main
```

### 6.2. Importar no Vercel

1. vercel.com → Import Project
2. Conecte o repositório GitHub
3. Configure as variáveis de ambiente (mesmas do `.env`)
4. Deploy

### 6.3. Banco de dados em produção

Recomendados:
- **Neon** (PostgreSQL serverless, free tier generoso)
- **Supabase** (PostgreSQL + extras)
- **Railway** (simples, bom para MVP)

```bash
# Após configurar DATABASE_URL de produção:
npx prisma migrate deploy
```

### 6.4. Domínio

Configure `glaucobarber.com` no painel da Vercel.

### 6.5. Cron

O `vercel.json` já configura o cron diário às 8h:
```json
{ "path": "/api/cron/daily", "schedule": "0 8 * * *" }
```

---

## 7. Estrutura do projeto

```
src/
├── app/
│   ├── (auth)/          # login, signup, onboarding
│   ├── (dashboard)/     # painel autenticado
│   │   ├── dashboard/   # página principal
│   │   ├── clients/     # clientes
│   │   ├── services/    # serviços
│   │   ├── offers/      # ofertas e pacotes
│   │   ├── campaigns/   # campanhas
│   │   ├── integrations/# configuração Trinks
│   │   └── settings/    # configurações e billing
│   └── api/
│       ├── auth/        # NextAuth
│       ├── stripe/      # checkout + webhook
│       ├── trinks/      # sync manual
│       ├── ai/          # gerar sugestões
│       ├── suggestions/ # aprovar/dispensar
│       └── cron/        # cron diário
├── components/
│   ├── layout/          # sidebar, header
│   ├── ui/              # design system components
│   ├── dashboard/       # widgets do dashboard
│   └── shared/          # componentes comuns
├── lib/
│   ├── auth.ts          # NextAuth config
│   ├── prisma.ts        # Prisma client
│   ├── stripe.ts        # Stripe helpers
│   ├── utils.ts         # formatadores
│   ├── ai/              # provider de IA
│   │   ├── provider.ts  # factory + context builder
│   │   ├── anthropic.ts # implementação Claude
│   │   └── types.ts     # contratos
│   └── integrations/
│       └── trinks/      # adapter Trinks
├── config/
│   ├── features.ts      # feature flags
│   └── plans.ts         # definição de planos
└── types/
    └── next-auth.d.ts   # extensão de tipos
```

---

## 8. Arquitetura de domínios

### Domínio 1 — Platform SaaS (billing da plataforma)
```
Barbershop → PlatformSubscription → Stripe
```

### Domínio 2 — Barbearia para clientes (futuro)
```
Barbershop → Offer → Customer → Payment → Stripe Connect
```

### Domínio 3 — Inteligência (core)
```
Trinks → [sync] → DB local → AI context → Suggestions → Approval → Campaign
```

---

## 9. Roadmap sugerido pós-MVP

1. [ ] Formulário de cadastro de barbearia (signup completo)
2. [ ] Input de credenciais Trinks via UI (criptografado)
3. [ ] Sync automático via cron
4. [ ] Envio de mensagem para clientes (WhatsApp adapter)
5. [ ] Publicação de post no Instagram (adapter)
6. [ ] Stripe Connect para barbearias venderem para clientes
7. [ ] Dashboard de KPIs avançados
8. [ ] Multi-unidade / multi-tenant UI
9. [ ] Mobile (PWA ou React Native)

---

## 10. Contatos de adapters futuros

O sistema foi estruturado para suportar:

- **WhatsApp**: `lib/integrations/whatsapp/` (usar Evolution API ou Meta API)
- **Instagram**: `lib/integrations/instagram/` (Meta Graph API)
- **IA alternativa**: `lib/ai/` (implementar `AIProvider` com OpenAI/Groq)

Cada adapter implementa a interface definida em `types.ts` correspondente.
