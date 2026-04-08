# GlaucoBarber — Contexto do Projeto

## O que é

SaaS multi-tenant para barbearias. Cada barbearia tem seus próprios dados, usuários e configurações.

**Filosofia**: Trinks/Avec = backend operacional (agenda, clientes, serviços). Este app = camada de inteligência por cima (IA, campanhas, WhatsApp, financeiro).

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
    core/                 # SaaS genérico (reutilizável entre verticals)
      vertical.ts         # Interface VerticalConfig + loader da vertical ativa
      storage.ts          # Upload/delete de arquivos genérico por tenant
    vertical/
      barbershop/
        config.ts         # Config específica da barbearia (feature gates, prompts IA, etc.)
    ai/
      types.ts            # Interface AIProvider
      openai.ts           # Implementação OpenAI (prompts vêm do vertical config)
      provider.ts         # getAIProvider()
    billing.ts            # getPlan, hasFeature, consumeAiCredit (lê do vertical config)
    auth.ts               # Auth config
    prisma.ts             # Prisma client singleton
    storage.ts            # Wrappers de storage da barbearia (delega pro core/storage.ts)
    whatsapp.ts           # Envio via Meta API
    integrations/
      trinks/             # client.ts, sync.ts, mappers.ts, types.ts
      avec/               # client.ts, sync.ts, mappers.ts, types.ts
  components/
    layout/               # Header, Sidebar
    ui/                   # shadcn/ui components
    billing/              # UpgradeWall
```

---

## Modelo de dados (principais)

- **Barbershop**: tenant principal. Tem `brandStyle` (estilo visual para IA) e `campaignReferenceImageUrl` (foto de referência para campanhas)
- **Membership**: usuário ↔ barbearia (role: OWNER/STAFF)
- **Customer**: clientes com `lastWhatsappSentAt`, `lastAppointmentAt`, `trinksId`, `avecId`
- **Appointment**: agendamentos sincronizados do Trinks ou Avec (ou criados manualmente). Tem `trinksId` e `avecId` para rastrear origem.
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

## Identidade visual — Botões de ação com IA

Todo botão que dispara uma ação de IA (gera texto, imagem, análise, sugestão, etc.) deve usar obrigatoriamente a cor **roxa**:

```
bg-purple-600 hover:bg-purple-500 text-white
```

Ícones e destaques relacionados a IA usam `text-purple-400`, bordas `border-purple-500/30`, fundos `bg-purple-500/10`.

Botões de ação normais (salvar, confirmar, primário não-IA) continuam usando `bg-gold-500 hover:bg-gold-400 text-black`.

**Exemplos corretos:**
- Botão "Gerar campanha" → roxo (`bg-purple-600`)
- Botão "Analisar foto" → roxo (`bg-purple-600`)
- Botão "Salvar configurações" → dourado (`bg-gold-500`)
- Botão "Aprovar" → dourado ou neutro

Essa distinção visual sinaliza ao usuário que a ação vai consumir créditos de IA.

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

## Integrações Operacionais (Trinks / Avec)

Cada barbearia conecta **um** backend operacional. O campo `Integration.provider` define qual.

### Regras de leitura/escrita por registro

| Origem | Campo | Agendamento | Serviço | Cliente |
|---|---|---|---|---|
| Trinks ativo | `trinksId` | Ações completas (sync para Trinks) | Editável | Editável |
| Avec ativo | `avecId` | **Somente leitura** | Editável | Editável |
| Avec pausado/desconectado | `avecId` | Editável — liberado | Editável | Editável |
| Manual | nenhum | Ações completas | Editável | Editável |

**Regra chave**: `avecId` **nunca é apagado** no disconnect — serve como chave de deduplicação ao reconectar. A editabilidade é determinada em runtime: `avecId != null AND integration.provider="avec" AND status="ACTIVE"`.

### Trinks
- API REST completa (read + write). Autenticação: `X-Api-Key` header.
- Sync: clientes, serviços, agendamentos. Permite atualizar status e reagendar.
- Código: `src/lib/integrations/trinks/`

### Avec
- API de relatórios read-only (278 endpoints). Autenticação: `Authorization: Bearer <token>`.
- Sync: clientes (`/reports/0004`), serviços (`/reports/0031`), agendamentos (`/reports/0051`).
- Docs: https://doc.api.avec.beauty/llms.txt
- Status de agendamentos **não documentados** — mapeamento inferido em `avec/mappers.ts`, logar valores desconhecidos.
- Código: `src/lib/integrations/avec/`

### Cron de sync (`src/app/api/cron/hourly-sync/route.ts`)
- Roda a cada hora para todas as integrações com `status = ACTIVE`
- Roteia por `integration.provider`: "avec" → `syncAvecBarbershop`, "trinks" → `syncBarbershop`
- Providers desconhecidos são pulados com `console.warn` (sem lançar exceção)

### Toggle pausar/religar (`POST /api/integrations/toggle`)
- `enabled: false` → `status = UNCONFIGURED`, mantém `configJson` (credenciais preservadas)
- `enabled: true` → valida com `ping()`, `status = ACTIVE`, dispara sync
- Com integração pausada: dados existentes ficam editáveis, cron não roda

### Troca de provider
- Ao conectar Avec com Trinks ativo (ou vice-versa): provider anterior é desativado (`configJson = null`)
- IDs externos (`trinksId`, `avecId`) são preservados para deduplicação futura
- UI mostra dialog de confirmação antes de trocar

---

## Arquitetura Multi-Vertical (SaaS Core)

O código é separado em **core genérico** e **vertical específica** para permitir reuso em outros tipos de negócio no futuro.

### Como funciona

- `src/lib/core/vertical.ts` — Define a interface `VerticalConfig` e carrega a vertical ativa
- `src/lib/vertical/barbershop/config.ts` — Toda config específica de barbearia num único arquivo
- `src/lib/core/storage.ts` — Storage genérico por tenant (`uploadTenantFile`, `deleteTenantFile`, etc.)
- `src/lib/billing.ts` — Lê feature gates, custos de IA e labels do vertical config
- `src/lib/ai/openai.ts` — System prompts vêm do vertical config (não hardcoded)

### O que fica no vertical config (barbershop/config.ts)

| Área | O que é configurável |
|------|---------------------|
| **Billing** | Feature gates por plano, taxa de uso, nome do evento Stripe, cap mensal |
| **AI** | Custos por feature, labels, features de imagem, todos os system prompts |
| **Storage** | Nome do bucket |
| **Messaging** | Código de país padrão (55 = Brasil) |
| **Roles** | Papéis disponíveis (OWNER, BARBER, STAFF) |

### Para criar uma nova vertical (ex: salão de beleza)

1. Criar `src/lib/vertical/cabeleireira/config.ts` exportando um `VerticalConfig`
2. No `core/vertical.ts`, ler `process.env.VERTICAL` para escolher qual config carregar
3. Criar o app na estrutura monorepo: `apps/cabeleireira/` apontando para o mesmo core

### Regras ao modificar código

- **Nunca hardcode** valores específicos de barbearia em `billing.ts`, `ai/openai.ts` ou `core/storage.ts`
- Novos feature gates, custos de IA ou prompts devem ser adicionados em `vertical/barbershop/config.ts`
- `storage.ts` (raiz do lib) contém wrappers domain-specific que delegam pro `core/storage.ts`
- Os wrappers em `storage.ts` mantêm a API existente (`uploadCampaignImage`, etc.) — não quebrar

---

## App Mobile (Capacitor)

O app mobile é uma WebView nativa que carrega o site `glaucobarber.com`. Não é um app offline — precisa de internet.

### Estrutura

```
capacitor.config.ts          # Config do Capacitor (appId, server URL, plugins)
mobile-shell/
  index.html                 # Shell mínimo (loading + tela offline)
src/
  lib/mobile/
    capacitor.ts             # Bridge nativo (status bar, push, deep links, back button)
  components/mobile/
    NativeInit.tsx            # Client component que inicializa plugins (no layout raiz)
android/                     # Projeto Android gerado (no .gitignore)
```

### Comandos

```bash
npm run cap:sync            # Sincroniza TODAS as plataformas (Android + iOS)
npm run cap:sync:android    # Sincroniza só Android
npm run cap:sync:ios        # Sincroniza só iOS
npm run cap:open:android    # Abre no Android Studio
npm run cap:open:ios        # Abre no Xcode
npm run cap:run:android     # Roda no emulador/device Android
npm run cap:run:ios         # Roda no simulador/iPhone
npm run cap:build:android   # Build APK release
```

### Como gerar o APK para Play Store

1. `npm run cap:sync:android` — sincroniza config e plugins
2. `npm run cap:open:android` — abre Android Studio
3. No Android Studio: Build > Generate Signed Bundle / APK
4. Upload do AAB no Google Play Console

### Como gerar o IPA para Apple App Store

Pré-requisitos: Mac com Xcode instalado + Apple Developer Account (US$99/ano)

1. `npx cap add ios` — cria o projeto iOS (só na primeira vez)
2. `npm run cap:sync:ios` — sincroniza config e plugins
3. `npm run cap:open:ios` — abre no Xcode
4. No Xcode: selecionar Team (conta Apple Developer)
5. Product > Archive > Distribute App > App Store Connect
6. Upload do IPA no App Store Connect

### Regras ao modificar

- `android/` é **gerado** — nunca editar manualmente (usar `cap sync` pra atualizar)
- `capacitor.config.ts` é a fonte de verdade pra config nativa
- `mobile-shell/index.html` é só o fallback offline — o app carrega o site real
- `NativeInit` está no layout raiz — inicializa plugins apenas quando roda no Capacitor
- Push notifications: token é recebido no `capacitor.ts` — precisa de endpoint `/api/push/register` (TODO)

---

## Ambientes (Staging + Produção)

O projeto usa 2 ambientes com bancos Supabase separados:

| Ambiente | URL | Banco | Branch |
|----------|-----|-------|--------|
| **Produção** | `glaucobarber.com` | Supabase "glaucobarber" (prod) | `main` |
| **Staging** | Preview deploy da Vercel | Supabase "glaucobarber-staging" | qualquer branch / PR |

### Como funciona

- Push para `main` → deploy automático em **produção** (Vercel)
- Push para qualquer outra branch → deploy **preview** (staging) com banco staging
- A Vercel separa env vars por ambiente: Production vs Preview

### Variáveis de ambiente na Vercel

```
Settings > Environment Variables

Variável                         | Production (main)       | Preview (branches)
DATABASE_URL                     | postgres://prod...      | postgres://staging...
DIRECT_URL                       | postgres://prod...      | postgres://staging...
NEXT_PUBLIC_SUPABASE_URL         | https://prod.supabase.co| https://staging.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY    | eyJ...prod              | eyJ...staging
SUPABASE_SERVICE_ROLE_KEY        | eyJ...prod              | eyJ...staging
STRIPE_SECRET_KEY                | sk_live_...             | sk_test_...
NEXT_PUBLIC_APP_URL              | https://glaucobarber.com| (Vercel preenche automaticamente)
```

### Variáveis compartilhadas (mesmo valor em todos os ambientes)

- `OPENAI_API_KEY` — mesma chave
- `CRON_SECRET` — mesmo valor
- `WHATSAPP_VERIFY_TOKEN` — mesmo valor (mas WhatsApp só funciona em prod)

### Desenvolvimento local

Local usa `.env.local` apontando pro banco **staging** (mesmo banco dos previews).
Para popular o banco staging: `npx prisma db push` (cria tabelas) + `npm run db:seed` (dados de teste).

### Regras

- **Nunca** usar credenciais de produção localmente
- **Stripe**: `sk_test_` em staging/local, `sk_live_` só em produção
- **WhatsApp**: só envia mensagens reais em produção
- Ao rodar migrations: rodar primeiro em staging, validar, depois em produção

---

## Convenções importantes

- `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"` antes de rodar npx/node
- Banco: Supabase PostgreSQL em `aws-1-us-east-1.pooler.supabase.com`
- Imagens de campanha vão para bucket `campaign-images` no Supabase Storage
- Copilot limita a 20 mensagens por thread (apaga as mais antigas)

---

## Checklist para novo produto/feature

Sempre que criar um novo módulo ou funcionalidade, verificar todos os itens abaixo:

### 1. Schema & dados
- [ ] Adicionar model no `prisma/schema.prisma` + enum de status se necessário
- [ ] Rodar `npx prisma db push`

### 2. Feature gate & acesso
- [ ] Adicionar a feature ao array `ALL_FEATURES` em `src/lib/access.ts`
- [ ] Decidir se vai no `featureGates.FREE` do `vertical/barbershop/config.ts` (se NÃO estiver lá = disponível no FREE)
- [ ] Adicionar seed em `src/app/api/admin/features/seed/route.ts` para todos os tiers (FREE, TRIAL, PRO)

### 3. IA (se consumir créditos)
- [ ] Adicionar custo em `featureCosts` no `vertical/barbershop/config.ts`
- [ ] Adicionar label em `aiFeatureLabels`
- [ ] Adicionar system prompt em `ai.prompts` (nunca hardcoded)
- [ ] Adicionar método na interface `AIProvider` em `src/lib/ai/types.ts`
- [ ] Implementar o método em `src/lib/ai/openai.ts`
- [ ] Usar `checkAiAllowance` antes + `consumeAiCredit` depois na route

### 4. Storage (se armazenar arquivos)
- [ ] Adicionar wrappers domain-specific em `src/lib/storage.ts` (delegam para `core/storage.ts`)
- [ ] Definir folder no bucket (ex: `"vitrine"`, `"campaigns"`)

### 5. API routes
- [ ] CRUD básico em `src/app/api/{feature}/`
- [ ] Checar kill switch relevante se houver (`getKillSwitch("kill_xxx")`)

### 6. Cron (se tiver publicação agendada)
- [ ] Criar `src/app/api/cron/{feature}-publish/route.ts` (padrão: Bearer CRON_SECRET, máx 20 por run, registra em CronRun)
- [ ] Adicionar ao monitoramento de crons no admin overview (`src/app/admin/overview/`)

### 7. Admin
- [ ] Adicionar kill switch `kill_{feature}` no painel admin (`src/app/admin/overview/overview-client.tsx`)
- [ ] Checar o kill switch nas routes relevantes

### 8. Dashboard (UI)
- [ ] Server component busca dados → passa como props para client component
- [ ] Wrapper: `<div className="flex flex-col h-full">`
- [ ] Header: `<Header title="..." userName={session.user.name} />`
- [ ] Botões de IA: `bg-purple-600 hover:bg-purple-500` — botões normais: `bg-gold-500 hover:bg-gold-400`

### 9. Navegação
- [ ] Adicionar ao array `NAV` em `src/components/layout/sidebar.tsx`
- [ ] Verificar se `mobile-nav.tsx` usa o mesmo array (se não, adicionar lá também)

### 10. Landing page — `src/app/page.tsx`
- [ ] Adicionar card da feature na grade "Como funciona"
- [ ] Mencionar na seção de preços (qual plano inclui)

### 11. Billing page — `src/app/(dashboard)/billing/billing-client.tsx`
- [ ] Adicionar linha na tabela "Comparar planos" com disponibilidade por tier
