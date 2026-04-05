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
npm run cap:sync    # Sincroniza web assets + plugins pro Android
npm run cap:open    # Abre no Android Studio
npm run cap:run     # Roda no emulador/device conectado
npm run cap:build   # Build APK release
```

### Como gerar o APK para Play Store

1. `npm run cap:sync` — sincroniza config e plugins
2. `npm run cap:open` — abre Android Studio
3. No Android Studio: Build > Generate Signed Bundle / APK
4. Upload do AAB no Google Play Console

### Regras ao modificar

- `android/` é **gerado** — nunca editar manualmente (usar `cap sync` pra atualizar)
- `capacitor.config.ts` é a fonte de verdade pra config nativa
- `mobile-shell/index.html` é só o fallback offline — o app carrega o site real
- `NativeInit` está no layout raiz — inicializa plugins apenas quando roda no Capacitor
- Push notifications: token é recebido no `capacitor.ts` — precisa de endpoint `/api/push/register` (TODO)

---

## Convenções importantes

- `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"` antes de rodar npx/node
- Banco: Supabase PostgreSQL em `aws-1-us-east-1.pooler.supabase.com`
- Imagens de campanha vão para bucket `campaign-images` no Supabase Storage
- Copilot limita a 20 mensagens por thread (apaga as mais antigas)
