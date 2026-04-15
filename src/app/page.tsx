import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Link from "next/link";
import Image from "next/image";
import {
  BarChart3, Users, Sparkles, Calendar,
  TrendingUp, Megaphone, ArrowRight, CheckCircle2,
  MessageSquare, Bot, Camera, X, GalleryHorizontal,
  HeartHandshake, Repeat2, Scissors, Croissant,
  Coffee, CakeSlice, PawPrint, Dumbbell, Utensils,
} from "lucide-react";
import { InstallAppButton } from "@/components/pwa/install-button";

const SEGMENTS = [
  {
    slug: "barbearia",
    name: "Barbearia",
    icon: Scissors,
    color: "#b8973a",
    bg: "#fdf8ec",
    example: "Cliente sumiu ha 3 semanas? O bot avisa e traz de volta.",
  },
  {
    slug: "padaria",
    name: "Padaria",
    icon: Croissant,
    color: "#c2843a",
    bg: "#fdf6ec",
    example: "Foto do bolo quentinho no WhatsApp. Clientes que voltam todo dia.",
  },
  {
    slug: "cafeteria",
    name: "Cafeteria",
    icon: Coffee,
    color: "#6f4e37",
    bg: "#fdf3eb",
    example: "Combo cafe + croissant com desconto pra quem nao aparece ha 10 dias.",
  },
  {
    slug: "boleria",
    name: "Boleria / Confeitaria",
    icon: CakeSlice,
    color: "#c2548a",
    bg: "#fdf0f5",
    example: "Lancou sabor novo? IA manda campanha pro WhatsApp de toda a base.",
  },
  {
    slug: "petshop",
    name: "Pet Shop",
    icon: PawPrint,
    color: "#3a7dc2",
    bg: "#edf5fd",
    example: "Bolinha nao tomou banho ha 30 dias. Bot avisa o dono automaticamente.",
  },
  {
    slug: "academia",
    name: "Academia",
    icon: Dumbbell,
    color: "#2a8a3a",
    bg: "#edf8ef",
    example: "Aluno parou de aparecer? Mensagem de reativacao com desconto no dia certo.",
  },
  {
    slug: "restaurante",
    name: "Restaurante",
    icon: Utensils,
    color: "#c23a3a",
    bg: "#fdf0f0",
    example: "Cardapio da semana toda segunda-feira no WhatsApp. Automatico.",
  },
];

export default async function RootPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-[#080810] text-foreground">
      {/* ── Navbar ──────────────────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#080810]/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-192.png" alt="Voltaki" className="h-9 w-9 sm:hidden rounded-xl" />
            <Image src="/logo-dark.png" alt="Voltaki" width={160} height={48} className="hidden sm:block h-10 w-auto" priority />
          </div>
          <div className="flex items-center gap-3">
            <a href="#segmentos" className="hidden sm:block text-sm text-muted-foreground hover:text-foreground transition-colors">
              Para o seu negócio
            </a>
            <a href="#precos" className="hidden sm:block text-sm text-muted-foreground hover:text-foreground transition-colors">
              Preços
            </a>
            <div className="hidden sm:block">
              <InstallAppButton />
            </div>
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Entrar
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-[#080810] hover:bg-gold-400 transition-colors"
            >
              Começar grátis
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center overflow-hidden pt-16">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-[700px] h-[700px] rounded-full bg-gold-500/6 blur-[160px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-gold-600/4 blur-[120px]" />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(201,168,76,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.5) 1px, transparent 1px)",
              backgroundSize: "80px 80px",
            }}
          />
        </div>

        <div className="relative mx-auto max-w-7xl px-6 lg:px-8 py-24 grid lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div className="animate-fade-in">
            <div className="inline-flex items-center gap-2 rounded-full border border-gold-500/30 bg-gold-500/8 px-3 py-1 text-xs text-gold-400 mb-8">
              <Sparkles className="h-3 w-3" />
              WhatsApp automático · IA · Campanhas · Fidelização
            </div>

            <h1 className="font-display text-5xl lg:text-6xl xl:text-7xl font-bold leading-none mb-6 tracking-tight">
              Seu cliente{" "}
              <span className="bg-gradient-to-r from-gold-400 via-[#e8c870] to-gold-500 bg-clip-text text-transparent">
                sempre volta.
              </span>
            </h1>

            <p className="text-lg lg:text-xl text-muted-foreground mb-6 max-w-lg leading-relaxed">
              Enquanto você foca no seu negócio, o Voltaki cuida de trazer o cliente de volta.
              WhatsApp automático, campanhas com IA e follow-up que parece humano — tudo no piloto automático.
            </p>

            <div className="mb-10 rounded-xl border border-gold-500/20 bg-gold-500/6 px-4 py-3 max-w-lg">
              <p className="font-semibold text-gold-400 text-sm">
                Negócios que usam Voltaki faturam 15% a 25% a mais no 1º mês.*
              </p>
              <p className="text-muted-foreground text-xs mt-1">
                Sem precisar contratar ninguém. Sem ficar no celular. Teste grátis — se não funcionar, não paga.
              </p>
            </div>

            <div className="flex flex-wrap gap-4 mb-12">
              <Link
                href="/signup"
                className="group inline-flex items-center gap-2 rounded-lg bg-gold-500 px-6 py-3.5 text-sm font-semibold text-[#080810] hover:bg-gold-400 transition-all shadow-gold-md"
              >
                Começar grátis
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <a
                href="#como-funciona"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-3.5 text-sm font-semibold text-foreground hover:bg-surface-800 transition-colors"
              >
                Como funciona
              </a>
              <InstallAppButton />
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              {[
                "Clientes reativados automaticamente",
                "WhatsApp bot incluso",
                "IA que escreve igual gente",
              ].map((item) => (
                <span key={item} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-gold-400 shrink-0" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Right */}
          <div className="relative flex justify-center lg:justify-end animate-slide-in-left">
            <div className="relative w-[360px] lg:w-[440px]">
              <div className="absolute -inset-4 rounded-3xl bg-gold-500/10 blur-2xl" />

              <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-gold-lg">
                <Image
                  src="/hero-cliente.jpg"
                  alt="Cliente voltando ao estabelecimento"
                  width={440}
                  height={560}
                  className="object-cover w-full h-[480px] lg:h-[560px] object-top"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#080810] via-[#080810]/20 to-transparent" />
              </div>

              <div className="absolute bottom-0 inset-x-0 p-5 grid grid-cols-3 gap-3">
                {[
                  { value: "1.581", label: "Clientes" },
                  { value: "92%",   label: "Retenção" },
                  { value: "R$38k", label: "Faturamento" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-xl border border-white/10 bg-[#080810]/90 backdrop-blur-sm p-3 text-center"
                  >
                    <p className="text-base font-bold text-gold-400 tabular-nums">{s.value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="absolute -top-4 -right-4 flex items-center gap-2 rounded-xl border border-green-500/30 bg-[#080810]/90 backdrop-blur-sm px-3 py-2 shadow-lg">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
                </span>
                <span className="text-xs font-medium text-green-400">Cliente voltou agora</span>
              </div>

              <div className="absolute -bottom-4 -left-4 flex items-center gap-2 rounded-xl border border-gold-500/30 bg-[#080810]/90 backdrop-blur-sm px-3 py-2 shadow-lg">
                <Bot className="h-3.5 w-3.5 text-gold-400" />
                <span className="text-xs font-medium text-gold-400">Bot enviou 12 msgs hoje</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Números — o que você vai ganhar ─────────────────── */}
      <section className="py-20 border-t border-white/5 bg-gradient-to-b from-gold-500/5 to-transparent">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-3">O que você vai ganhar</p>
            <h2 className="font-display text-3xl lg:text-5xl font-bold text-foreground leading-tight">
              Negócios que usam Voltaki<br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-gold-400 via-[#e8c870] to-gold-500 bg-clip-text text-transparent"> faturam mais no primeiro mês.</span>
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Não é promessa. É o que acontece quando seus clientes param de sumir sem você perceber.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border/40 rounded-2xl overflow-hidden border border-border">
            {[
              {
                value: "+23%",
                label: "Faturamento no 1º mês",
                desc: "Negócios que ativam o follow-up automático faturam em média 23% a mais já no primeiro mês.",
                highlight: true,
              },
              {
                value: "3×",
                label: "Mais retorno que anúncio pago",
                desc: "Reativar um cliente que já te conhece custa 5× menos do que conquistar um novo do zero.",
                highlight: false,
              },
              {
                value: "68%",
                label: "Taxa de resposta no WhatsApp",
                desc: "Enquanto e-mail tem menos de 2%, WhatsApp com mensagem certa tem 68% de resposta.",
                highlight: false,
              },
              {
                value: "< 5min",
                label: "Para ativar e ver resultado",
                desc: "Sem técnico, sem integração complicada. Você configura hoje e o bot já começa a trabalhar.",
                highlight: false,
              },
            ].map((s) => (
              <div key={s.label} className={`p-7 text-center flex flex-col items-center gap-3 ${s.highlight ? "bg-gold-500/8" : "bg-[#080810]"}`}>
                <p className={`text-5xl lg:text-6xl font-black tabular-nums ${s.highlight ? "text-gold-400" : "text-foreground"}`}>{s.value}</p>
                <p className="text-sm font-bold text-foreground">{s.label}</p>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-[200px]">{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 rounded-lg bg-gold-500 px-7 py-3.5 text-sm font-bold text-[#080810] hover:bg-gold-400 transition-all shadow-gold-md"
            >
              Quero esses resultados
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <p className="text-xs text-muted-foreground mt-3">Teste grátis · Sem cartão de crédito</p>
          </div>
        </div>
      </section>

      {/* ── O que o Voltaki faz ───────────────────────────────── */}
      <section className="py-28 border-t border-white/5">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-3">O que o Voltaki faz</p>
            <h2 className="font-display text-3xl lg:text-4xl font-bold text-foreground">
              Tudo que você precisaria de um<br className="hidden sm:block" /> assistente — sem contratar ninguém.
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Enquanto você atende, o Voltaki trabalha nos bastidores trazendo cliente de volta e gerando receita.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: <Bot className="h-6 w-6" />,
                title: "WhatsApp automático",
                desc: "Bot envia mensagens de reativação, pós-atendimento e promoção. Configura uma vez, trabalha todo dia.",
              },
              {
                icon: <Users className="h-6 w-6" />,
                title: "Gestão de clientes",
                desc: "Base completa com histórico, quanto cada um gastou, quem é VIP e quem sumiu há quanto tempo.",
              },
              {
                icon: <Sparkles className="h-6 w-6" />,
                title: "Copiloto com IA",
                desc: "A IA analisa seu negócio e sugere: qual cliente chamar hoje, que oferta criar, o que está perdendo.",
              },
              {
                icon: <Megaphone className="h-6 w-6" />,
                title: "Campanhas com IA",
                desc: "Fale o tema, a IA escreve o texto e cria a arte. Aprovado, vai direto pro Instagram e WhatsApp.",
              },
              {
                icon: <HeartHandshake className="h-6 w-6" />,
                title: "Pós-atendimento",
                desc: "Detecta quem foi atendido e manda mensagem personalizada pedindo avaliação ou agendando retorno.",
              },
              {
                icon: <Camera className="h-6 w-6" />,
                title: "Instagram integrado",
                desc: "Publique posts e carrosséis direto do sistema em 1 clique. A IA gera legenda e hashtags.",
              },
              {
                icon: <TrendingUp className="h-6 w-6" />,
                title: "Metas e financeiro",
                desc: "Faturamento do dia, semana e mês. Compare com sua meta. Veja ticket médio e mais vendidos.",
              },
              {
                icon: <Repeat2 className="h-6 w-6" />,
                title: "Reativação automática",
                desc: "Identifica clientes inativos e dispara mensagens no momento certo — sem você lembrar de ninguém.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-border bg-card p-5 hover:border-gold-500/30 hover:bg-card/80 transition-all"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-500/10 border border-gold-500/15 text-gold-400 mb-4 group-hover:bg-gold-500/15 transition-colors">
                  {f.icon}
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1.5">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Como funciona — 3 passos para os resultados ─────── */}
      <section id="como-funciona" className="py-28 border-t border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-3">Como funciona</p>
            <h2 className="font-display text-3xl lg:text-4xl font-bold text-foreground">
              3 passos para chegar<br className="hidden sm:block" /> nos +23% de faturamento
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Sem técnico. Sem curso. Sem ficar grudado no celular.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                step: "01",
                title: "Conecte seus clientes",
                desc: "Importe sua base ou sincronize com seu sistema. Em menos de 5 minutos o Voltaki já sabe quem são seus clientes, quando visitaram e quanto gastaram.",
                icon: <Users className="h-6 w-6" />,
                after: "Sua base organizada. Inativos identificados.",
              },
              {
                step: "02",
                title: "O bot trabalha por você",
                desc: "O sistema detecta automaticamente quem sumiu, qual oferta faz sentido e manda a mensagem certa na hora certa — sem você fazer nada.",
                icon: <Bot className="h-6 w-6" />,
                after: "Clientes recebendo mensagens personalizadas enquanto você atende.",
              },
              {
                step: "03",
                title: "Você vê o dinheiro entrar",
                desc: "Acompanhe no dashboard quantos clientes voltaram, quanto você faturou a mais e quais ações geraram mais resultado. Ajuste o que quiser.",
                icon: <TrendingUp className="h-6 w-6" />,
                after: "+23% de faturamento no 1º mês em média.",
              },
            ].map((item, i) => (
              <div key={i} className="relative flex flex-col gap-5">
                {/* Step connector line */}
                {i < 2 && (
                  <div className="hidden md:block absolute top-8 left-[calc(100%+8px)] w-8 border-t border-dashed border-gold-500/30 z-10" />
                )}
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-500/10 border border-gold-500/20 text-gold-400">
                    {item.icon}
                  </div>
                  <div className="pt-1">
                    <span className="text-xs font-bold text-gold-500/60 uppercase tracking-widest">Passo {item.step}</span>
                    <h3 className="text-base font-bold text-foreground mt-0.5">{item.title}</h3>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                <div className="rounded-lg border border-gold-500/20 bg-gold-500/6 px-4 py-2.5 text-xs font-medium text-gold-300">
                  ✓ {item.after}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Para o seu negócio ───────────────────────────────── */}
      <section id="segmentos" className="py-24 border-t border-white/5">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-3">Para o seu negócio</p>
            <h2 className="font-display text-3xl lg:text-4xl font-bold text-foreground">
              Funciona para qualquer negócio<br className="hidden sm:block" /> que depende de clientes que voltam
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Clique no seu segmento e veja exemplos reais de como o Voltaki aumenta o faturamento.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {SEGMENTS.map((seg) => (
              <Link
                key={seg.slug}
                href={`/venda/${seg.slug}`}
                className="group relative rounded-2xl border border-border bg-card p-5 hover:border-gold-500/40 hover:bg-card/70 transition-all"
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl mb-4 transition-transform group-hover:scale-105"
                  style={{ background: `${seg.color}18`, border: `1px solid ${seg.color}35` }}
                >
                  <seg.icon className="h-5 w-5" style={{ color: seg.color }} />
                </div>
                <p className="text-sm font-semibold text-foreground mb-1.5">{seg.name}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{seg.example}</p>
                <div className="mt-4 flex items-center gap-1 text-[11px] font-medium" style={{ color: seg.color }}>
                  Ver como funciona <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            ))}
            {/* Extra CTA card */}
            <div className="rounded-2xl border border-dashed border-border bg-transparent p-5 flex flex-col items-center justify-center text-center gap-3">
              <p className="text-sm font-medium text-muted-foreground">Outro segmento?</p>
              <p className="text-xs text-muted-foreground">O Voltaki funciona para qualquer negócio com base de clientes.</p>
              <Link
                href="/signup"
                className="text-xs font-semibold text-gold-400 hover:text-gold-300 transition-colors"
              >
                Testar grátis →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Preços ───────────────────────────────────────────── */}
      <section id="precos" className="py-28 border-t border-white/5">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-3">Preços</p>
            <h2 className="font-display text-3xl lg:text-4xl font-bold text-foreground">
              Simples e sem surpresas
            </h2>
            <p className="mt-4 text-muted-foreground max-w-md mx-auto">
              Comece grátis. Pague só quando ver resultado.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <div className="rounded-2xl border border-border bg-card p-7 flex flex-col">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Trial gratuito</p>
                <p className="font-display text-4xl font-bold text-foreground">R$0</p>
                <p className="text-xs text-muted-foreground mt-1">Sem cartão de crédito</p>
              </div>
              <ul className="mt-7 space-y-3 flex-1">
                {[
                  "Trial de 14 dias com acesso completo",
                  "Agenda ao vivo",
                  "Gestão de clientes",
                  "Metas de faturamento",
                  "Vitrine no Instagram",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-gold-400 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
                {[
                  "Copiloto IA",
                  "Campanhas com IA",
                  "WhatsApp automático",
                  "Relatórios financeiros",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-xs text-muted-foreground/40">
                    <X className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="mt-8 block text-center rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-surface-800 transition-colors"
              >
                Começar grátis
              </Link>
            </div>

            <div className="rounded-2xl border border-gold-500/40 bg-gradient-to-b from-gold-500/8 to-transparent p-7 flex flex-col relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="rounded-full bg-gold-500 px-3 py-0.5 text-[11px] font-bold text-[#080810]">Mais popular</span>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-2">Profissional</p>
                <p className="font-display text-4xl font-bold text-foreground">R$49<span className="text-lg font-normal text-muted-foreground">,90/mês</span></p>
                <p className="text-xs text-muted-foreground mt-1">Tudo desbloqueado. Menos de R$1,70 por dia.</p>
              </div>
              <ul className="mt-7 space-y-3 flex-1">
                {[
                  "300 créditos de IA/mês",
                  "Copiloto IA (conselheiro do negócio)",
                  "Campanhas com IA (texto + imagem)",
                  "WhatsApp BOT automático",
                  "Reativação automática de clientes",
                  "Pós-atendimento inteligente",
                  "Vitrine no Instagram (carrossel)",
                  "Relatórios financeiros completos",
                  "Metas de faturamento",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-xs text-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-gold-400 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="mt-8 block text-center rounded-lg bg-gold-500 px-4 py-2.5 text-sm font-bold text-[#080810] hover:bg-gold-400 transition-colors"
              >
                Assinar Profissional
              </Link>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-8">
            Cancelamento a qualquer momento. Créditos extras disponíveis por R$20 (+200 chamadas de IA).
          </p>
        </div>
      </section>

      {/* ── Depoimento ───────────────────────────────────────── */}
      <section className="py-28 border-t border-white/5">
        <div className="mx-auto max-w-4xl px-6 lg:px-8 text-center">
          <div className="relative rounded-3xl border border-gold-500/20 bg-gradient-to-b from-gold-500/6 to-transparent p-10 lg:p-16">
            <span className="absolute top-8 left-8 text-7xl font-serif text-gold-500/15 leading-none select-none">&quot;</span>

            <div className="relative">
              <p className="text-xl lg:text-2xl font-medium text-foreground leading-relaxed mb-8">
                Abri o app de manhã e a IA já tinha sugerido o post, a mensagem pro cliente que sumiu
                e a promoção da tarde. Só precisei aprovar. Parece ter um assistente trabalhando enquanto durmo.
              </p>

              <div className="flex items-center justify-center gap-4">
                <div className="h-14 w-14 rounded-full border-2 border-gold-500/40 bg-gold-500/20 flex items-center justify-center">
                  <span className="text-xl font-bold text-gold-400">R</span>
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">Rafael Costa</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Padaria Sabor do Dia</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Final ────────────────────────────────────────── */}
      <section className="py-28 border-t border-white/5">
        <div className="mx-auto max-w-3xl px-6 lg:px-8 text-center">
          <h2 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-5">
            Seu cliente sumiu?{" "}
            <span className="bg-gradient-to-r from-gold-400 to-[#e8c870] bg-clip-text text-transparent">
              A gente traz ele de volta.
            </span>
          </h2>
          <p className="text-muted-foreground mb-4 text-lg">
            Configure em menos de 5 minutos. Veja o resultado no primeiro mês.
          </p>
          <p className="text-sm text-gold-400/80 mb-10">
            Teste grátis — se não gostar, não paga. Simples assim.
          </p>
          <Link
            href="/signup"
            className="group inline-flex items-center gap-2 rounded-xl bg-gold-500 px-8 py-4 text-base font-bold text-[#080810] hover:bg-gold-400 transition-all shadow-gold-lg"
          >
            Começar grátis agora
            <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <p className="text-xs text-muted-foreground mt-4">Sem cartão de crédito · Configuração em minutos</p>

          <div className="mt-6 flex justify-center">
            <InstallAppButton />
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-8">
        <div className="mx-auto max-w-7xl px-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center">
            <Image src="/logo-dark.png" alt="Voltaki" width={90} height={28} className="h-6 w-auto opacity-60" />
          </div>
          <p className="text-xs text-muted-foreground">© 2025 Voltaki · Seu cliente sempre volta.</p>
          <div className="flex items-center gap-4">
            <a href="#segmentos" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Segmentos</a>
            <a href="#precos" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Preços</a>
            <Link href="/login" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Entrar
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
