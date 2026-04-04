"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Coffee, Unlock, PartyPopper, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const RELAXING_MESSAGES = [
  { emoji: "🛋️", title: "Dia de folga!", subtitle: "Aproveita pra descansar, assistir uma série e recarregar as energias." },
  { emoji: "😴", title: "Nada de cortes hoje!", subtitle: "Deixa a máquina descansar — ela também merece." },
  { emoji: "🏖️", title: "Folga merecida!", subtitle: "Vai curtir o dia! A cadeira tá guardada pra quando você voltar." },
  { emoji: "🎮", title: "Hoje é modo OFF!", subtitle: "Zero clientes, zero preocupação. Joga aquele joguinho em paz." },
  { emoji: "☕", title: "Café sem pressa hoje!", subtitle: "Sem fila, sem agendamento. Só você e o cafezinho." },
];

interface Props {
  dateIso: string;
  dateLabel: string;
}

export function DayOffScreen({ dateIso, dateLabel }: Props) {
  const router = useRouter();
  const [unlocking, setUnlocking] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [confettiPieces, setConfettiPieces] = useState<Array<{ id: number; x: number; delay: number; color: string; size: number }>>([]);

  // Pick a consistent message per date
  const msgIndex = dateIso.split("-").reduce((sum, n) => sum + parseInt(n, 10), 0) % RELAXING_MESSAGES.length;
  const msg = RELAXING_MESSAGES[msgIndex];

  const spawnConfetti = useCallback(() => {
    const colors = ["#EAB308", "#A855F7", "#EC4899", "#3B82F6", "#10B981", "#F97316"];
    const pieces = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.5,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 8 + 4,
    }));
    setConfettiPieces(pieces);
  }, []);

  async function handleUnlock() {
    setUnlocking(true);
    try {
      const d = new Date(dateIso + "T12:00:00");
      const dayOfMonth = d.getDate();
      const month = d.getMonth() + 1;
      const year = d.getFullYear();

      const res = await fetch("/api/goals/unlock-day", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day: dayOfMonth, month, year }),
      });

      if (res.ok) {
        setUnlocked(true);
        spawnConfetti();
        // Refresh the page after the celebration
        setTimeout(() => router.refresh(), 2000);
      }
    } finally {
      setUnlocking(false);
    }
  }

  // Cleanup confetti after animation
  useEffect(() => {
    if (confettiPieces.length > 0) {
      const timer = setTimeout(() => setConfettiPieces([]), 3000);
      return () => clearTimeout(timer);
    }
  }, [confettiPieces]);

  return (
    <div className="relative flex flex-col items-center justify-center py-16 px-4 overflow-hidden">
      {/* Confetti layer */}
      {confettiPieces.length > 0 && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {confettiPieces.map((p) => (
            <div
              key={p.id}
              className="absolute animate-confetti-fall"
              style={{
                left: `${p.x}%`,
                top: "-10px",
                animationDelay: `${p.delay}s`,
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
                borderRadius: Math.random() > 0.5 ? "50%" : "2px",
                transform: `rotate(${Math.random() * 360}deg)`,
              }}
            />
          ))}
        </div>
      )}

      {/* Main content */}
      <div className={`flex flex-col items-center gap-6 transition-all duration-700 ${unlocked ? "scale-110" : ""}`}>
        {/* Animated icon */}
        <div className={`relative ${unlocked ? "animate-bounce" : "animate-float"}`}>
          {unlocked ? (
            <div className="flex items-center justify-center w-24 h-24 rounded-full bg-gold-500/20 border-2 border-gold-500/40">
              <PartyPopper className="h-12 w-12 text-gold-400" />
            </div>
          ) : (
            <div className="flex items-center justify-center w-24 h-24 rounded-full bg-surface-800 border-2 border-border">
              <Coffee className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
          {!unlocked && (
            <div className="absolute -top-1 -right-1 flex items-center justify-center w-8 h-8 rounded-full bg-surface-900 border border-border">
              <span className="text-lg">{msg.emoji}</span>
            </div>
          )}
        </div>

        {/* Message */}
        {unlocked ? (
          <div className="text-center space-y-2 animate-fade-in">
            <h2 className="text-2xl font-bold text-gold-400 flex items-center gap-2 justify-center">
              <Sparkles className="h-6 w-6" />
              Bora trabalhar!
              <Sparkles className="h-6 w-6" />
            </h2>
            <p className="text-muted-foreground text-sm">
              Dia desbloqueado! Preparando sua agenda...
            </p>
          </div>
        ) : (
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-foreground">{msg.title}</h2>
            <p className="text-muted-foreground text-sm max-w-sm">{msg.subtitle}</p>
            <p className="text-xs text-muted-foreground/60 capitalize mt-1">{dateLabel}</p>
          </div>
        )}

        {/* Unlock button */}
        {!unlocked && (
          <Button
            onClick={handleUnlock}
            disabled={unlocking}
            size="lg"
            className="mt-4 bg-gold-500 hover:bg-gold-400 text-black font-semibold gap-2 transition-all hover:scale-105 active:scale-95"
          >
            <Unlock className="h-4 w-4" />
            {unlocking ? "Desbloqueando..." : "Quero trabalhar hoje!"}
          </Button>
        )}

        {/* Subtle hint */}
        {!unlocked && (
          <p className="text-xs text-muted-foreground/40 mt-2">
            Ao desbloquear, o dia será adicionado como dia de trabalho extra nas suas metas.
          </p>
        )}
      </div>
    </div>
  );
}
