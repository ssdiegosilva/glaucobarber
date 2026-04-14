import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Zap, ArrowRight, CheckCircle2, MessageSquare, Bot,
  BadgePercent, Smartphone, Star, ChevronRight,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────── */
/*  Segment data                                                   */
/* ─────────────────────────────────────────────────────────────── */

type Segment = {
  slug: string;
  name: string;
  emoji: string;
  tagline: string;
  subtitle: string;
  heroImage: string;
  accentColor: string;
  accentLight: string;
  accentText: string;
  businessName: string;
  owner: string;
  product: string;            // main product for offer example
  productPrice: string;
  discountPct: number;
  discountedPrice: string;
  daysInactive: number;
  productImage: string;       // Unsplash image for WhatsApp mockup
  scenarios: {
    title: string;
    before: string;
    after: string;
  }[];
  testimonial: string;
};

const SEGMENTS: Record<string, Segment> = {
  padaria: {
    slug: "padaria",
    name: "Padaria",
    emoji: "🥐",
    tagline: "Faça seu cliente voltar todo dia ao pão quentinho.",
    subtitle: "Padarias que usam Voltaki recuperam clientes inativos com uma foto de bolo e um WhatsApp automático.",
    heroImage: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&q=80",
    accentColor: "#c2843a",
    accentLight: "#fdf6ec",
    accentText: "#7a4e1e",
    businessName: "Padaria Dona Rosa",
    owner: "Dona Rosa Almeida",
    product: "Bolo de cenoura com calda",
    productPrice: "R$ 45,00",
    discountPct: 20,
    discountedPrice: "R$ 36,00",
    daysInactive: 14,
    productImage: "https://images.unsplash.com/photo-1621303837174-89787a7d4729?w=600&q=80",
    scenarios: [
      {
        title: "Cliente sumiu há 2 semanas",
        before: "Dona Rosa não sabe quais clientes pararam de vir",
        after: "Voltaki detecta quem não comprou há 14 dias e manda WhatsApp com foto do bolo preferido deles",
      },
      {
        title: "Oferta direcionada com imagem",
        before: "Promoções genéricas no cartaz da porta que ninguém vê",
        after: "Cliente recebe foto do bolo de cenoura com 20% off direto no celular — e reserva antes de chegar",
      },
      {
        title: "Fidelização automática",
        before: "Clientes fiéis não são reconhecidos ou recompensados",
        after: "Bot manda mensagem personalizada após cada compra: 'Obrigado, Carlos! Nos vemos amanhã 🥐'",
      },
    ],
    testimonial: "Recuperei 3 clientes só na primeira semana. O bot mandou a foto do bolo e eles apareceram no mesmo dia.",
  },

  cafeteria: {
    slug: "cafeteria",
    name: "Cafeteria",
    emoji: "☕",
    tagline: "Todo bom café merece um cliente que volta toda manhã.",
    subtitle: "Cafeterias que usam Voltaki automatizam o contato com clientes e enchem as mesas sem precisar fazer nada.",
    heroImage: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&q=80",
    accentColor: "#6f4e37",
    accentLight: "#fdf3eb",
    accentText: "#4a2e1a",
    businessName: "Café Coração",
    owner: "Bruno Tavares",
    product: "Combo café + croissant",
    productPrice: "R$ 22,00",
    discountPct: 15,
    discountedPrice: "R$ 18,70",
    daysInactive: 10,
    productImage: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&q=80",
    scenarios: [
      {
        title: "Manhã sem movimento",
        before: "Bruno não sabe quais clientes não aparecem há mais de 10 dias",
        after: "Voltaki manda WhatsApp com foto do combo café + croissant com 15% off para quem sumiu",
      },
      {
        title: "Aniversariantes do mês",
        before: "Nenhum contato especial para clientes em datas importantes",
        after: "Bot detecta aniversário e manda mensagem carinhosa com oferta exclusiva: 'Feliz aniversário! Café hoje é por nossa conta ☕'",
      },
      {
        title: "Pós-visita automático",
        before: "Cliente vai embora e não ouve mais nada da cafeteria",
        after: "30 minutos depois da visita: 'Obrigado pela visita, Bruno! Deixou algum comentário? Nos vemos amanhã ☕'",
      },
    ],
    testimonial: "Nunca pensei que um WhatsApp com a foto do cappuccino ia trazer tanto cliente de volta. Funcionou demais.",
  },

  boleria: {
    slug: "boleria",
    name: "Boleria",
    emoji: "🎂",
    tagline: "Cada bolo merece um cliente esperando.",
    subtitle: "Bolerias usam Voltaki para mandar fotos dos novos bolos direto no WhatsApp dos clientes que sumiram.",
    heroImage: "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=800&q=80",
    accentColor: "#c2548a",
    accentLight: "#fdf0f5",
    accentText: "#7a1f46",
    businessName: "Boleria Encanto",
    owner: "Camila Ferreira",
    product: "Bolo red velvet decorado",
    productPrice: "R$ 120,00",
    discountPct: 10,
    discountedPrice: "R$ 108,00",
    daysInactive: 30,
    productImage: "https://images.unsplash.com/photo-1586788680434-30d324b2d46f?w=600&q=80",
    scenarios: [
      {
        title: "Cliente que pediu no mês passado",
        before: "Camila não sabe quem pediu bolo há mais de 30 dias e está na hora de reativar",
        after: "Voltaki manda foto do bolo red velvet com 10% de desconto para todos os clientes inativos há mais de 30 dias",
      },
      {
        title: "Lançamento de novo sabor",
        before: "Novo bolo lançado e ninguém sabe — só postou no Instagram",
        after: "Campanha criada pela IA com texto e foto do novo sabor vai direto pro WhatsApp dos clientes fiéis",
      },
      {
        title: "Encomendas antecipadas",
        before: "Semana que vem tem dia das mães e ela não sabe quem pode encomendar",
        after: "Bot identifica clientes que pediram no ano passado e manda oferta exclusiva de encomenda antecipada",
      },
    ],
    testimonial: "Mandei a foto do bolo red velvet pra 18 clientes que não pediam há um mês. 11 responderam no mesmo dia.",
  },

  petshop: {
    slug: "petshop",
    name: "Pet Shop",
    emoji: "🐾",
    tagline: "Seu cliente ama o pet. O pet merece cuidados. Você faz a conexão.",
    subtitle: "Pet shops que usam Voltaki agendam banho e tosa no piloto automático, sem ligar para ninguém.",
    heroImage: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&q=80",
    accentColor: "#3a7dc2",
    accentLight: "#edf5fd",
    accentText: "#1a4a7a",
    businessName: "Pet Shop Patinhas",
    owner: "Fernanda Lima",
    product: "Banho e tosa completo",
    productPrice: "R$ 80,00",
    discountPct: 15,
    discountedPrice: "R$ 68,00",
    daysInactive: 30,
    productImage: "https://images.unsplash.com/photo-1615751072497-5f5169febe17?w=600&q=80",
    scenarios: [
      {
        title: "Pet que não voltou para o banho",
        before: "Fernanda não rastreia quais pets ficaram 30 dias sem banho",
        after: "Voltaki detecta e manda: 'O Bolinha está na hora do banho! 15% off esta semana 🐾'",
      },
      {
        title: "Lembretes de vacina",
        before: "Clientes esquecem do reforço anual e o pet fica desprotegido",
        after: "Bot calcula a data do próximo reforço e manda lembrete automático 2 semanas antes",
      },
      {
        title: "Fidelização de clientes frequentes",
        before: "Tutores que vêm todo mês não recebem nenhum reconhecimento especial",
        after: "Após a 5ª visita: 'Você é um cliente especial! Próximo banho com 20% de desconto 🐶'",
      },
    ],
    testimonial: "O bot mandou mensagem para 22 clientes cujos pets não tomavam banho há mais de 30 dias. 14 agendaram na hora.",
  },

  academia: {
    slug: "academia",
    name: "Academia",
    emoji: "💪",
    tagline: "Traga de volta quem cancelou a matrícula antes do verão.",
    subtitle: "Academias usam Voltaki para reativar alunos inativos e reduzir a evasão com mensagens no momento certo.",
    heroImage: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80",
    accentColor: "#2a8a3a",
    accentLight: "#edf8ef",
    accentText: "#1a5a28",
    businessName: "Academia Força Total",
    owner: "Rafael Mendes",
    product: "Plano mensal",
    productPrice: "R$ 99,00",
    discountPct: 25,
    discountedPrice: "R$ 74,25",
    daysInactive: 7,
    productImage: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&q=80",
    scenarios: [
      {
        title: "Aluno que parou de frequentar",
        before: "Rafael não percebe quando um aluno para de aparecer até o mês seguinte",
        after: "Voltaki detecta quem não entrou há 7 dias e manda motivação: 'Sumiu! Volta essa semana e ganhe 25% no próximo mês 💪'",
      },
      {
        title: "Renovação de matrícula",
        before: "Matriculas vencem e o aluno some sem avisar",
        after: "5 dias antes do vencimento, bot manda proposta de renovação personalizada com desconto especial",
      },
      {
        title: "Campanha verão",
        before: "Setembro chega e a academia precisa atrair alunos para o verão",
        after: "IA cria campanha com arte e texto para Instagram + WhatsApp em um clique",
      },
    ],
    testimonial: "Recuperei 8 alunos que eu achava que tinham cancelado. O bot mandou no momento certo e eles voltaram.",
  },

  restaurante: {
    slug: "restaurante",
    name: "Restaurante",
    emoji: "🍽️",
    tagline: "Mesa cheia todo almoço. Sem precisar ficar ligando para ninguém.",
    subtitle: "Restaurantes usam Voltaki para trazer clientes de volta com promoções e cardápio direto no WhatsApp.",
    heroImage: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
    accentColor: "#c23a3a",
    accentLight: "#fdf0f0",
    accentText: "#7a1a1a",
    businessName: "Restaurante Sabor da Terra",
    owner: "Marcos Oliveira",
    product: "Prato executivo + sobremesa",
    productPrice: "R$ 35,00",
    discountPct: 20,
    discountedPrice: "R$ 28,00",
    daysInactive: 21,
    productImage: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80",
    scenarios: [
      {
        title: "Cliente que parou de almoçar",
        before: "Marcos não rastreia quais clientes frequentes sumiram há 3 semanas",
        after: "Voltaki identifica e manda foto do prato do dia com desconto: 'Sentimos sua falta! Almoço por R$ 28 essa semana 🍽️'",
      },
      {
        title: "Cardápio semanal automático",
        before: "Segunda-feira de manhã Marcos lembra que precisava mandar o cardápio — tarde demais",
        after: "Bot manda cardápio da semana toda segunda às 7h para todos os clientes cadastrados, automaticamente",
      },
      {
        title: "Reservas no fim de semana",
        before: "Fim de semana chega e as mesas ficam vazias por falta de comunicação",
        after: "Quinta-feira o bot pergunta para clientes frequentes: 'Vai almoçar conosco no sábado? Reserve agora!'",
      },
    ],
    testimonial: "Na primeira semana o bot recuperou 5 clientes que a gente não via há mais de um mês. Valeu muito.",
  },
};

export function generateStaticParams() {
  return Object.keys(SEGMENTS).map((slug) => ({ segmento: slug }));
}

/* ─────────────────────────────────────────────────────────────── */
/*  Page                                                           */
/* ─────────────────────────────────────────────────────────────── */

export default async function VendaSegmentoPage({
  params,
}: {
  params: Promise<{ segmento: string }>;
}) {
  const { segmento } = await params;
  const seg = SEGMENTS[segmento];
  if (!seg) notFound();

  const ac = seg.accentColor;
  const al = seg.accentLight;
  const at = seg.accentText;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* ── Navbar ── */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: `${ac}20`, border: `1px solid ${ac}40` }}>
              <Zap className="h-4 w-4" style={{ color: ac }} />
            </div>
            <span className="font-bold text-gray-900 text-lg">Voltaki</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
              Entrar
            </Link>
            <Link
              href="/signup"
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors"
              style={{ background: ac }}
            >
              Começar grátis
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative pt-24 pb-20 overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${al} 0%, white 60%)` }}>
        <div className="mx-auto max-w-7xl px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
          {/* Left */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold mb-6"
              style={{ background: `${ac}15`, color: at, border: `1px solid ${ac}30` }}>
              {seg.emoji} Para {seg.name}
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 leading-tight mb-5">
              {seg.tagline}
            </h1>
            <p className="text-lg text-gray-600 mb-8 leading-relaxed max-w-lg">
              {seg.subtitle}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-lg px-6 py-3.5 text-sm font-semibold text-white transition-colors shadow-md"
                style={{ background: ac }}
              >
                Começar grátis — sem cartão
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#como-funciona"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-6 py-3.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Ver como funciona
              </a>
            </div>
            <div className="mt-6 flex flex-wrap gap-4 text-xs text-gray-500">
              {["Setup em 2 minutos", "Sem cartão de crédito", "WhatsApp automático incluso"].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: ac }} />
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Right — hero image */}
          <div className="relative hidden lg:block">
            <div className="absolute -inset-4 rounded-3xl opacity-20 blur-2xl"
              style={{ background: ac }} />
            <div className="relative rounded-2xl overflow-hidden border border-gray-100 shadow-xl">
              <Image
                src={seg.heroImage}
                alt={seg.name}
                width={600}
                height={440}
                className="object-cover w-full h-[400px]"
                unoptimized
              />
              <div className="absolute inset-0 bg-gradient-to-t from-white/30 to-transparent" />
            </div>

            {/* Floating badge */}
            <div className="absolute -bottom-4 -left-4 flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-4 py-2.5 shadow-lg">
              <Bot className="h-4 w-4" style={{ color: ac }} />
              <span className="text-xs font-medium text-gray-700">Bot enviou 8 msgs hoje</span>
            </div>
            <div className="absolute -top-4 -right-4 flex items-center gap-2 rounded-xl border border-green-100 bg-white px-3 py-2 shadow-lg">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
              </span>
              <span className="text-xs font-medium text-green-700">Cliente voltou agora</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Como funciona ── */}
      <section id="como-funciona" className="py-24 border-t border-gray-100">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: ac }}>
              Como funciona para {seg.name}
            </p>
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900">
              3 situações reais no seu negócio
            </h2>
            <p className="mt-3 text-gray-500 max-w-lg mx-auto">
              Veja como a <strong>{seg.businessName}</strong> usa o Voltaki no dia a dia.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {seg.scenarios.map((s, i) => (
              <div key={i} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl text-white text-sm font-bold mb-4"
                  style={{ background: ac }}>
                  {i + 1}
                </div>
                <h3 className="font-semibold text-gray-900 mb-4">{s.title}</h3>
                <div className="space-y-3">
                  <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 text-xs text-gray-400 line-through">
                    {s.before}
                  </div>
                  <div className="rounded-lg px-3 py-2 text-xs font-medium"
                    style={{ background: `${ac}10`, color: at, border: `1px solid ${ac}20` }}>
                    ✓ {s.after}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WhatsApp Offer Mockup ── */}
      <section className="py-24 border-t border-gray-100" style={{ background: al }}>
        <div className="mx-auto max-w-7xl px-6 lg:px-8 grid lg:grid-cols-2 gap-16 items-center">
          {/* Left — description */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold mb-6"
              style={{ background: `${ac}15`, color: at, border: `1px solid ${ac}25` }}>
              <BadgePercent className="h-3.5 w-3.5" />
              Oferta Direcionada com imagem no WhatsApp
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-5">
              Mande a foto do produto<br />com a oferta personalizada
            </h2>
            <p className="text-gray-600 mb-6 leading-relaxed">
              O Voltaki permite que você selecione um produto com foto, defina um desconto e o sistema
              manda automaticamente a imagem com a mensagem personalizada por IA para cada cliente pelo WhatsApp.
            </p>
            <ul className="space-y-3">
              {[
                `Filtra clientes que não compram há ${seg.daysInactive}+ dias`,
                "Foto do produto direto no WhatsApp",
                `Desconto de ${seg.discountPct}% calculado automaticamente`,
                "Mensagem personalizada por IA para cada cliente",
                "Acompanhe quem recebeu, abriu e respondeu",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-gray-700">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" style={{ color: ac }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Right — WhatsApp phone mockup */}
          <div className="flex justify-center lg:justify-end">
            <div className="relative w-[320px]">
              {/* Phone frame */}
              <div className="rounded-[2.5rem] bg-gray-900 p-3 shadow-2xl">
                <div className="rounded-[2rem] bg-[#e5ddd5] overflow-hidden">
                  {/* WA header */}
                  <div className="bg-[#075e54] px-4 py-3 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">
                      {seg.businessName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold">{seg.businessName}</p>
                      <p className="text-green-200 text-[10px]">online</p>
                    </div>
                  </div>

                  {/* Chat area */}
                  <div className="p-3 space-y-3 min-h-[400px] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MCIgaGVpZ2h0PSI1MCI+PGNpcmNsZSBjeD0iMjUiIGN5PSIyNSIgcj0iMSIgZmlsbD0icmdiYSgwLDAsMCwwLjAzKSIvPjwvc3ZnPg==')]">
                    {/* Incoming message with image */}
                    <div className="flex flex-col items-start max-w-[90%]">
                      <div className="rounded-2xl rounded-tl-sm bg-white shadow-sm overflow-hidden">
                        <Image
                          src={seg.productImage}
                          alt={seg.product}
                          width={260}
                          height={180}
                          className="object-cover w-full h-[180px]"
                          unoptimized
                        />
                        <div className="px-3 py-2.5">
                          <p className="text-gray-900 text-[13px] leading-snug">
                            Olá <strong>João</strong>! 👋 Sentimos sua falta aqui na{" "}
                            <strong>{seg.businessName}</strong>.
                          </p>
                          <p className="text-gray-700 text-[12px] mt-1.5 leading-snug">
                            Preparamos uma oferta especial para você:{" "}
                            <strong style={{ color: at }}>{seg.product}</strong> por apenas{" "}
                            <strong style={{ color: at }}>{seg.discountedPrice}</strong>{" "}
                            <span className="line-through text-gray-400">{seg.productPrice}</span>{" "}
                            ({seg.discountPct}% off)! 🎉
                          </p>
                          <p className="text-gray-500 text-[11px] mt-1">
                            Válido esta semana. Nos vemos em breve!
                          </p>
                          <p className="text-gray-400 text-[10px] mt-1 text-right">14:32 ✓✓</p>
                        </div>
                      </div>
                    </div>

                    {/* Reply */}
                    <div className="flex flex-col items-end">
                      <div className="rounded-2xl rounded-tr-sm px-3 py-2 shadow-sm max-w-[80%]"
                        style={{ background: `${ac}20` }}>
                        <p className="text-gray-800 text-[12px]">
                          Oi! Que saudade 😍 Vou aí hoje!
                        </p>
                        <p className="text-gray-400 text-[10px] mt-0.5 text-right">14:35 ✓✓</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Label */}
              <div className="absolute -right-4 top-1/3 bg-white rounded-xl border border-gray-100 shadow-md px-3 py-2 flex items-center gap-2">
                <Smartphone className="h-3.5 w-3.5" style={{ color: ac }} />
                <span className="text-xs font-medium text-gray-700">WhatsApp real do cliente</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-24 border-t border-gray-100">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900">Tudo que sua {seg.name} precisa</h2>
            <p className="mt-3 text-gray-500">Em um único app, no celular ou computador.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: <Bot className="h-5 w-5" />,
                title: "WhatsApp automático",
                desc: "Bot envia mensagens personalizadas para clientes inativos, aniversariantes e pós-visita. Você configura uma vez.",
              },
              {
                icon: <BadgePercent className="h-5 w-5" />,
                title: "Ofertas com foto",
                desc: "Selecione um produto com foto, defina o desconto e mande para clientes inativos. Tudo automático.",
              },
              {
                icon: <MessageSquare className="h-5 w-5" />,
                title: "Campanha com IA",
                desc: "IA escreve o texto e cria a arte da campanha em segundos. Você aprova e vai para o Instagram.",
              },
              {
                icon: <Star className="h-5 w-5" />,
                title: "Gestão de clientes",
                desc: "Veja quem são seus melhores clientes, quem sumiu e quem está prestes a virar fiel.",
              },
            ].map((f) => (
              <div key={f.title}
                className="rounded-2xl border border-gray-100 bg-white p-5 hover:border-gray-200 hover:shadow-sm transition-all">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white mb-4"
                  style={{ background: `${ac}15`, color: ac }}>
                  {f.icon}
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1.5">{f.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonial ── */}
      <section className="py-24 border-t border-gray-100" style={{ background: al }}>
        <div className="mx-auto max-w-2xl px-6 text-center">
          <div className="relative rounded-3xl border bg-white p-10 shadow-sm"
            style={{ borderColor: `${ac}30` }}>
            <span className="absolute top-6 left-8 text-6xl font-serif opacity-10 leading-none select-none"
              style={{ color: ac }}>&quot;</span>
            <p className="text-lg font-medium text-gray-800 leading-relaxed mb-6 relative">
              {seg.testimonial}
            </p>
            <div className="flex items-center justify-center gap-3">
              <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold"
                style={{ background: ac }}>
                {seg.owner.charAt(0)}
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900">{seg.owner}</p>
                <p className="text-xs text-gray-500">{seg.businessName}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 border-t border-gray-100">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-5">
            Sua {seg.name} merece clientes que voltam.
          </h2>
          <p className="text-gray-500 mb-8 text-lg">
            Comece grátis e veja seu primeiro cliente reagir em menos de 24h.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-xl px-8 py-4 text-base font-bold text-white shadow-md transition-opacity hover:opacity-90"
            style={{ background: ac }}
          >
            Criar conta grátis agora
            <ArrowRight className="h-5 w-5" />
          </Link>
          <p className="text-xs text-gray-400 mt-4">Sem cartão de crédito · Configuração em 2 minutos</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 py-8">
        <div className="mx-auto max-w-7xl px-6 flex items-center justify-between flex-wrap gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md"
              style={{ background: `${ac}15`, border: `1px solid ${ac}25` }}>
              <Zap className="h-3 w-3" style={{ color: ac }} />
            </div>
            <span className="text-sm font-semibold text-gray-500">Voltaki</span>
          </Link>
          <p className="text-xs text-gray-400">© 2025 Voltaki. Para {seg.name}s que crescem.</p>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1 transition-colors">
              Página principal <ChevronRight className="h-3 w-3" />
            </Link>
            <Link href="/login" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
              Entrar
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
