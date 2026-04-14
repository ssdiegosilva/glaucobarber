import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Link from "next/link";
import Image from "next/image";
import {
  BarChart3, Users, Sparkles, Calendar,
  TrendingUp, Megaphone, ArrowRight, CheckCircle2,
  MessageSquare, Bot, Camera, X, GalleryHorizontal,
  HeartHandshake, Repeat2,
} from "lucide-react";
import { InstallAppButton } from "@/components/pwa/install-button";

export default async function RootPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-[#080810] text-foreground">
      {/* ── Navbar ──────────────────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#080810]/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <Image src="/logo-dark.png" alt="Voltaki" width={120} height={36} className="h-8 w-auto" priority />
          </div>
          <div className="flex items-center gap-3">
            <a href="#precos" className="hidden sm:block text-sm text-muted-foreground hover:text-foreground transition-colors">
              Preços
            </a>
            <div className="hidden sm:block">
              <InstallAppButton />
            </div>
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
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
        {/* background glow */}
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

            <p className="text-lg lg:text-xl text-muted-foreground mb-10 max-w-lg leading-relaxed">
              O Voltaki manda WhatsApp automático para clientes que sumiram,
              cria campanhas com IA e mostra exatamente o que fazer para seu negócio crescer.
            </p>

            <div className="mb-10 space-y-2 text-sm text-foreground/90">
              <p className="font-semibold text-gold-400">
                +15% a +25% de faturamento no 1º mês* com follow-up automático e campanhas guiadas por IA.
              </p>
              <p className="text-muted-foreground text-xs">
                Teste sem risco: use, comprove resultado; se não curtir, não paga nada.
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

            {/* trust row */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              {[
                "Clientes fidelizados automaticamente",
                "WhatsApp bot incluso",
                "Campanhas com IA",
              ].map((item) => (
                <span key={item} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-gold-400 shrink-0" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Right — photo + stats overlay */}
          <div className="relative flex justify-center lg:justify-end animate-slide-in-left">
            <div className="relative w-[360px] lg:w-[440px]">
              <div className="absolute -inset-4 rounded-3xl bg-gold-500/10 blur-2xl" />

              <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-gold-lg">
                <Image
                  src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=880&q=80"
                  alt="Negócio fidelizando clientes com Voltaki"
                  width={440}
                  height={560}
                  className="object-cover w-full h-[480px] lg:h-[560px]"
                  priority
                  unoptimized
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#080810] via-[#080810]/20 to-transparent" />
              </div>

              {/* stats overlay */}
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

              {/* floating badge — live */}
              <div className="absolute -top-4 -right-4 flex items-center gap-2 rounded-xl border border-green-500/30 bg-[#080810]/90 backdrop-blur-sm px-3 py-2 shadow-lg">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
                </span>
                <span className="text-xs font-medium text-green-400">Cliente voltou agora</span>
              </div>

              {/* floating badge — bot */}
              <div className="absolute -bottom-4 -left-4 flex items-center gap-2 rounded-xl border border-gold-500/30 bg-[#080810]/90 backdrop-blur-sm px-3 py-2 shadow-lg">
                <Bot className="h-3.5 w-3.5 text-gold-400" />
                <span className="text-xs font-medium text-gold-400">Bot enviou 12 msgs hoje</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Como funciona ────────────────────────────────────── */}
      <section id="como-funciona" className="py-28 border-t border-white/5">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-3">Como funciona</p>
            <h2 className="font-display text-3xl lg:text-4xl font-bold text-foreground">
              Pare de perder cliente. Comece a trazer de volta.
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Todo negócio perde cliente por falta de contato. O Voltaki resolve isso sozinho.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                before: "Cliente sumiu há 30 dias e você nem sabe",
                after: "Bot manda WhatsApp automático. Ele volta sem você fazer nada.",
                icon: <MessageSquare className="h-5 w-5" />,
              },
              {
                before: "Sem ideia do que postar nas redes sociais",
                after: "IA cria o texto e a arte da campanha. Você só aprova.",
                icon: <Megaphone className="h-5 w-5" />,
              },
              {
                before: "Não sabe quem são seus melhores clientes",
                after: "Dashboard mostra quem gasta mais, quem sumiu e o que fazer.",
                icon: <BarChart3 className="h-5 w-5" />,
              },
            ].map((item, i) => (
              <div
                key={i}
                className="rounded-2xl border border-border bg-card p-6 hover:border-gold-500/25 transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500/12 border border-gold-500/20 text-gold-400 mb-5">
                  {item.icon}
                </div>
                <div className="space-y-3">
                  <div className="rounded-lg bg-surface-800 px-3 py-2 text-xs text-muted-foreground line-through opacity-70">
                    {item.before}
                  </div>
                  <div className="rounded-lg border border-gold-500/20 bg-gold-500/6 px-3 py-2 text-xs text-gold-300">
                    ✓ {item.after}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section className="py-28 border-t border-white/5 bg-gradient-to-b from-transparent to-surface-950/30">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-3">Funcionalidades</p>
            <h2 className="font-display text-3xl lg:text-4xl font-bold text-foreground">
              Tudo que você precisa para fidelizar
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: <Bot className="h-6 w-6" />,
                title: "WhatsApp automático",
                desc: "Bot envia mensagens de reativação, pós-atendimento e promoção automaticamente. Você configura uma vez e ele trabalha todo dia.",
              },
              {
                icon: <Users className="h-6 w-6" />,
                title: "Gestão de clientes",
                desc: "Base completa com histórico, quanto cada cliente gastou, frequência, quem é VIP e quem sumiu. Tudo organizado.",
              },
              {
                icon: <Sparkles className="h-6 w-6" />,
                title: "Copiloto com IA",
                desc: "A IA analisa seu negócio e sugere: qual cliente chamar, que oferta criar, qual serviço destacar. Com um clique.",
              },
              {
                icon: <Megaphone className="h-6 w-6" />,
                title: "Campanhas com IA",
                desc: "Escreva o tema e a IA gera o texto e a imagem da campanha. Aprovado, vai direto pro Instagram.",
              },
              {
                icon: <HeartHandshake className="h-6 w-6" />,
                title: "Pós-atendimento",
                desc: "Detecta quem acabou de ser atendido e manda mensagem personalizada de avaliação ou retorno. Automático.",
              },
              {
                icon: <Camera className="h-6 w-6" />,
                title: "Instagram integrado",
                desc: "Conecte o Instagram em 1 clique. Publique posts e carrosséis direto do sistema. A IA gera a legenda.",
              },
              {
                icon: <TrendingUp className="h-6 w-6" />,
                title: "Metas e financeiro",
                desc: "Acompanhe faturamento do dia, semana e mês. Compare com sua meta. Veja ticket médio e serviços mais vendidos.",
              },
              {
                icon: <Calendar className="h-6 w-6" />,
                title: "Agenda ao vivo",
                desc: "Todos os agendamentos em tempo real. Integrado com Trinks e Avec. Sem copiar nada manualmente.",
              },
              {
                icon: <Repeat2 className="h-6 w-6" />,
                title: "Reativação automática",
                desc: "O sistema identifica clientes inativos e dispara mensagens no momento certo. Você não precisa lembrar de ninguém.",
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

      {/* ── Preços ───────────────────────────────────────────── */}
      <section id="precos" className="py-28 border-t border-white/5">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-3">Preços</p>
            <h2 className="font-display text-3xl lg:text-4xl font-bold text-foreground">
              Simples e sem surpresas
            </h2>
            <p className="mt-4 text-muted-foreground max-w-md mx-auto">
              Comece grátis. Evolua quando precisar.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* FREE */}
            <div className="rounded-2xl border border-border bg-card p-7 flex flex-col">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Trial gratuito</p>
                <p className="font-display text-4xl font-bold text-foreground">R$0</p>
                <p className="text-xs text-muted-foreground mt-1">Sem cartão de crédito</p>
              </div>
              <ul className="mt-7 space-y-3 flex-1">
                {[
                  "Trial de 7 dias com acesso completo",
                  "Agenda ao vivo",
                  "Gestão de clientes",
                  "Metas de faturamento",
                  "Vitrine no Instagram (carrossel)",
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

            {/* PROFISSIONAL */}
            <div className="rounded-2xl border border-gold-500/40 bg-gradient-to-b from-gold-500/8 to-transparent p-7 flex flex-col relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="rounded-full bg-gold-500 px-3 py-0.5 text-[11px] font-bold text-[#080810]">Mais popular</span>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-gold-400 mb-2">Profissional</p>
                <p className="font-display text-4xl font-bold text-foreground">R$49<span className="text-lg font-normal text-muted-foreground">,90/mês</span></p>
                <p className="text-xs text-muted-foreground mt-1">Tudo desbloqueado, sem taxas extras</p>
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

      {/* ── Social Proof ─────────────────────────────────────── */}
      <section className="py-28 border-t border-white/5">
        <div className="mx-auto max-w-4xl px-6 lg:px-8 text-center">
          <div className="relative rounded-3xl border border-gold-500/20 bg-gradient-to-b from-gold-500/6 to-transparent p-10 lg:p-16">
            <span className="absolute top-8 left-8 text-7xl font-serif text-gold-500/15 leading-none select-none">&quot;</span>

            <div className="relative">
              <p className="text-xl lg:text-2xl font-medium text-foreground leading-relaxed mb-8">
                Abri o app de manhã e a IA já tinha sugerido o post, a mensagem pro cliente que sumiu
                e a promoção da tarde. Só precisei aprovar.
              </p>

              <div className="flex items-center justify-center gap-4">
                <div className="relative h-14 w-14 rounded-full overflow-hidden border-2 border-gold-500/40 bg-gold-500/20 flex items-center justify-center">
                  <span className="text-xl font-bold text-gold-400">R</span>
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">Rafael Costa</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-muted-foreground">Padaria Sabor do Dia</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ───────────────────────────────────────── */}
      <section className="py-28 border-t border-white/5">
        <div className="mx-auto max-w-3xl px-6 lg:px-8 text-center">
          <h2 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-5">
            Seu cliente sumiu?{" "}
            <span className="bg-gradient-to-r from-gold-400 to-[#e8c870] bg-clip-text text-transparent">
              A gente traz ele de volta.
            </span>
          </h2>
          <p className="text-muted-foreground mb-10 text-lg">
            Crie sua conta grátis e comece a fidelizar em menos de 2 minutos.
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
        <div className="mx-auto max-w-7xl px-6 flex items-center justify-between">
          <div className="flex items-center">
            <Image src="/logo-dark.png" alt="Voltaki" width={90} height={28} className="h-6 w-auto opacity-60" />
          </div>
          <p className="text-xs text-muted-foreground">© 2025 Voltaki</p>
          <div className="flex items-center gap-4">
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
