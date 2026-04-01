import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Link from "next/link";
import Image from "next/image";
import {
  Zap, BarChart3, Users, Sparkles, Calendar,
  TrendingUp, Megaphone, ArrowRight, CheckCircle2,
} from "lucide-react";

export default async function RootPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-[#080810] text-foreground">
      {/* ── Navbar ──────────────────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#080810]/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-500/20 border border-gold-500/30">
              <Zap className="h-4 w-4 text-gold-400" />
            </div>
            <span className="font-display text-lg font-bold text-foreground">GlaucoBarber</span>
          </div>
          <div className="flex items-center gap-3">
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
          {/* grid lines */}
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
              Integrado com Trinks · Movido por IA
            </div>

            <h1 className="font-display text-5xl lg:text-6xl xl:text-7xl font-bold leading-none mb-6 tracking-tight">
              O copiloto{" "}
              <span className="bg-gradient-to-r from-gold-400 via-[#e8c870] to-gold-500 bg-clip-text text-transparent">
                inteligente
              </span>
              <br />
              da sua barbearia
            </h1>

            <p className="text-lg lg:text-xl text-muted-foreground mb-10 max-w-lg leading-relaxed">
              Conecte o Trinks, veja sua agenda em tempo real,
              entenda cada cliente e deixe a IA sugerir o próximo movimento.
            </p>

            <div className="mb-10 space-y-2 text-sm text-foreground/90">
              <p className="font-semibold text-gold-400">
                +15% a +25% de faturamento no 1º mês* com follow-up automático e ofertas guiadas pela agenda.
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
            </div>

            {/* trust row */}
            <div className="flex items-center gap-6 text-xs text-muted-foreground">
              {[
                "Agenda ao vivo",
                "+1.500 clientes gerenciados",
                "IA como parceiro",
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
              {/* glow behind photo */}
              <div className="absolute -inset-4 rounded-3xl bg-gold-500/10 blur-2xl" />

              {/* photo */}
              <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-gold-lg">
                <Image
                  src="/glauco.jpg"
                  alt="Glauco — Art Shave Barbearia"
                  width={440}
                  height={560}
                  className="object-cover w-full h-[480px] lg:h-[560px]"
                  priority
                />
                {/* gradient overlay at bottom */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#080810] via-[#080810]/20 to-transparent" />
              </div>

              {/* stats overlay */}
              <div className="absolute bottom-0 inset-x-0 p-5 grid grid-cols-3 gap-3">
                {[
                  { value: "1.581", label: "Clientes" },
                  { value: "92%",   label: "Ocupação" },
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

              {/* floating card — live badge */}
              <div className="absolute -top-4 -right-4 flex items-center gap-2 rounded-xl border border-green-500/30 bg-[#080810]/90 backdrop-blur-sm px-3 py-2 shadow-lg">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
                </span>
                <span className="text-xs font-medium text-green-400">Trinks ao vivo</span>
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
              Pare de adivinhar. Comece a decidir.
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Barbearias que dependem de caderninho e intuição deixam dinheiro na mesa todo dia.
              GlaucoBarber muda isso.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                before: "Agenda no papel ou pelo celular da Trinks",
                after: "Dashboard ao vivo com ocupação, receita e horários livres",
                icon: <Calendar className="h-5 w-5" />,
              },
              {
                before: "Clientes inativos esquecidos por meses",
                after: "Lista de clientes que sumiram + sugestão de mensagem para reativar",
                icon: <Users className="h-5 w-5" />,
              },
              {
                before: "Sem ideia de quanto faturou na semana",
                after: "Relatórios de hoje, semana e mês com ticket médio e meta",
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
              Tudo que um barbeiro de alto nível precisa
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: <Calendar className="h-6 w-6" />,
                title: "Agenda ao vivo",
                desc: "Veja todos os agendamentos do dia diretamente da Trinks, em tempo real. Ocupação, horários livres e receita prevista.",
              },
              {
                icon: <Users className="h-6 w-6" />,
                title: "Gestão de clientes",
                desc: "Base completa com histórico, total gasto, frequência, tags e status (VIP, inativo). Mais de 1.500 clientes organizados.",
              },
              {
                icon: <Sparkles className="h-6 w-6" />,
                title: "IA como copiloto",
                desc: "Sugestões automáticas de ação: qual cliente reativar, que oferta criar, qual serviço destacar. Com um clique.",
              },
              {
                icon: <TrendingUp className="h-6 w-6" />,
                title: "Metas e relatórios",
                desc: "Compare faturamento hoje, esta semana e este mês com sua meta. Ticket médio, serviços mais vendidos e tendências.",
              },
              {
                icon: <Megaphone className="h-6 w-6" />,
                title: "Campanhas prontas",
                desc: "A IA escreve a mensagem de campanha para Instagram ou WhatsApp. Você aprova, ela publica.",
              },
              {
                icon: <Zap className="h-6 w-6" />,
                title: "Integração Trinks",
                desc: "Conecte em segundos com sua API Key. Todos os seus dados sincronizados sem retrabalho.",
              },
              {
                icon: <BarChart3 className="h-6 w-6" />,
                title: "Visão semanal e mensal",
                desc: "Não sabe quanto faturou na semana? Agora sabe. Gráfico de receita por dia, finalizados vs agendados.",
              },
              {
                icon: <CheckCircle2 className="h-6 w-6" />,
                title: "Pronto para usar",
                desc: "Sem configuração complicada. Crie sua conta, conecte a Trinks e comece a tomar decisões mais inteligentes hoje.",
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

      {/* ── Social Proof ─────────────────────────────────────── */}
      <section className="py-28 border-t border-white/5">
        <div className="mx-auto max-w-4xl px-6 lg:px-8 text-center">
          <div className="relative rounded-3xl border border-gold-500/20 bg-gradient-to-b from-gold-500/6 to-transparent p-10 lg:p-16">
            {/* decorative quotes */}
            <span className="absolute top-8 left-8 text-7xl font-serif text-gold-500/15 leading-none select-none">&quot;</span>

            <div className="relative">
              <p className="text-xl lg:text-2xl font-medium text-foreground leading-relaxed mb-8">
                GlaucoBarber me deu uma visão que eu nunca tive antes do meu negócio.
                Sei quem são meus melhores clientes, o que eles gastam, quando somem —
                e o que fazer pra trazer de volta.
              </p>

              <div className="flex items-center justify-center gap-4">
                <div className="relative h-14 w-14 rounded-full overflow-hidden border-2 border-gold-500/40">
                  <Image
                    src="/glauco.jpg"
                    alt="Glauco"
                    width={56}
                    height={56}
                    className="object-cover object-top"
                  />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">Glauco Silva</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-muted-foreground">Art Shave Barbearia</p>
                    <span className="text-muted-foreground/30">·</span>
                    {/* Art Shave logo */}
                    <Image
                      src="https://barbeariaartshave.com.br/wp-content/uploads/2024/08/logo-art-shave.png"
                      alt="Art Shave"
                      width={60}
                      height={20}
                      className="object-contain opacity-70 hover:opacity-100 transition-opacity"
                      unoptimized
                    />
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
          <div className="pointer-events-none absolute inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-gold-500/40 to-transparent" />

          <h2 className="font-display text-4xl lg:text-5xl font-bold text-foreground mb-5">
            Pronto para transformar<br />
            <span className="bg-gradient-to-r from-gold-400 to-[#e8c870] bg-clip-text text-transparent">
              sua barbearia?
            </span>
          </h2>
          <p className="text-muted-foreground mb-10 text-lg">
            Crie sua conta grátis e conecte o Trinks em menos de 2 minutos.
          </p>
          <Link
            href="/signup"
            className="group inline-flex items-center gap-2 rounded-xl bg-gold-500 px-8 py-4 text-base font-bold text-[#080810] hover:bg-gold-400 transition-all shadow-gold-lg"
          >
            Começar grátis agora
            <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <p className="text-xs text-muted-foreground mt-4">Sem cartão de crédito · Configuração em minutos</p>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-8">
        <div className="mx-auto max-w-7xl px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gold-500/15 border border-gold-500/20">
              <Zap className="h-3 w-3 text-gold-400" />
            </div>
            <span className="text-sm font-semibold text-muted-foreground">GlaucoBarber</span>
          </div>
          <p className="text-xs text-muted-foreground">© 2025 GlaucoBarber</p>
          <Link href="/login" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Entrar
          </Link>
        </div>
      </footer>
    </div>
  );
}
