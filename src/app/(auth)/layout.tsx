import { Scissors } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel – brand */}
      <div className="hidden lg:flex lg:w-1/2 bg-surface-950 border-r border-border flex-col justify-between p-12 relative overflow-hidden">
        {/* Background texture */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(201,168,76,0.08),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(201,168,76,0.05),transparent_60%)]" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500/15 border border-gold-500/30">
            <Scissors className="h-5 w-5 text-gold-400" />
          </div>
          <div>
            <p className="font-bold text-foreground">GlaucoBarber</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Copiloto IA</p>
          </div>
        </div>

        <div className="relative">
          <blockquote className="space-y-4">
            <p className="text-2xl font-light text-foreground/80 leading-relaxed">
              "Abri o app de manhã, a IA já tinha sugerido o post, a mensagem pro cliente que sumiu e a promoção da tarde.
              Só precisei aprovar."
            </p>
            <footer className="text-sm text-muted-foreground">
              — Glauco Silva, <cite className="not-italic text-gold-400">Art Shave Barbearia</cite>
            </footer>
          </blockquote>
        </div>

        <div className="relative flex items-center gap-6 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400 inline-block" />
            Integrado com Trinks
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-gold-400 inline-block" />
            IA generativa
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 inline-block" />
            Pronto para Vercel
          </span>
        </div>
      </div>

      {/* Right panel – form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
