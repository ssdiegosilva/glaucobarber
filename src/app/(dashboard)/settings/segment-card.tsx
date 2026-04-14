"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Store,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { SEGMENT_ICON_MAP } from "@/components/layout/sidebar";

const ICON_MAP = SEGMENT_ICON_MAP;

interface PublicSegment {
  id:              string;
  key:             string;
  displayName:     string;
  tenantLabel:     string;
  description:     string | null;
  icon:            string | null;
  colorPrimary:    string;
  colorBackground: string;
  colorCard:       string;
}

interface SegmentCardProps {
  currentSegmentId: string | null;
}

export function SegmentCard({ currentSegmentId }: SegmentCardProps) {
  const router = useRouter();
  const [segments, setSegments] = useState<PublicSegment[]>([]);
  const [selected, setSelected] = useState<PublicSegment | null>(null);
  const [pending, setPending] = useState<PublicSegment | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    fetch("/api/segments/public")
      .then((r) => r.json())
      .then((data: PublicSegment[]) => {
        setSegments(data);
        if (currentSegmentId) {
          const current = data.find((s) => s.id === currentSegmentId) ?? null;
          setSelected(current);
        } else {
          // Default: barbershop
          const barbershop = data.find((s) => s.key === "barbershop") ?? null;
          setSelected(barbershop);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [currentSegmentId]);

  function handleSelect(seg: PublicSegment) {
    if (seg.id === selected?.id) return;
    setPending(seg);
    setConfirmOpen(true);
  }

  async function handleConfirm() {
    if (!pending) return;
    setSaving(true);
    setConfirmOpen(false);

    const res = await fetch("/api/barbershop", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ segmentId: pending.id }),
    });

    if (!res.ok) {
      setSaving(false);
      setPending(null);
      return;
    }

    setSelected(pending);
    setPending(null);
    setSaving(false);
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          O segmento define o tema visual, os módulos disponíveis e os prompts de IA
          utilizados na plataforma.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {segments.map((seg) => {
            const IconComponent = seg.icon ? (ICON_MAP[seg.icon] ?? Store) : Store;
            const isCurrent = selected?.id === seg.id;
            const bg  = `hsl(${seg.colorBackground})`;
            const card = `hsl(${seg.colorCard})`;
            const accent = `hsl(${seg.colorPrimary})`;
            const accentFaint = `hsl(${seg.colorPrimary} / 0.15)`;

            return (
              <button
                key={seg.id}
                type="button"
                onClick={() => handleSelect(seg)}
                disabled={saving}
                className={cn(
                  "relative flex flex-col gap-0 rounded-xl border text-left transition-all overflow-hidden",
                  isCurrent
                    ? "ring-2"
                    : "border-border hover:border-white/20"
                )}
                style={isCurrent ? { borderColor: accent, boxShadow: `0 0 0 2px ${accent}` } : undefined}
              >
                {/* Mini theme preview */}
                <div
                  className="h-14 w-full relative flex items-end p-2 gap-1"
                  style={{ background: bg }}
                >
                  {/* Fake sidebar strip */}
                  <div className="absolute left-0 top-0 bottom-0 w-5 flex flex-col items-center gap-1 pt-2" style={{ background: card }}>
                    <div className="w-2 h-2 rounded-full" style={{ background: accent }} />
                    <div className="w-2 h-1 rounded-sm opacity-40" style={{ background: accent }} />
                    <div className="w-2 h-1 rounded-sm opacity-40" style={{ background: accent }} />
                    <div className="w-2 h-1 rounded-sm opacity-40" style={{ background: accent }} />
                  </div>
                  {/* Fake cards */}
                  <div className="ml-6 flex-1 flex gap-1">
                    <div className="flex-1 h-5 rounded" style={{ background: card, borderTop: `2px solid ${accent}` }} />
                    <div className="flex-1 h-5 rounded opacity-60" style={{ background: card }} />
                  </div>
                  {isCurrent && (
                    <CheckCircle2
                      className="absolute top-1.5 right-1.5 h-3.5 w-3.5"
                      style={{ color: accent }}
                    />
                  )}
                </div>

                {/* Label row */}
                <div
                  className="flex items-center gap-2 px-2.5 py-2"
                  style={{ background: card }}
                >
                  <div
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
                    style={{ background: accentFaint }}
                  >
                    <IconComponent className="h-3 w-3" style={{ color: accent }} />
                  </div>
                  <span className="text-xs font-medium text-foreground truncate">
                    {seg.displayName}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trocar segmento?</DialogTitle>
            <DialogDescription>
              Mudar para{" "}
              <strong className="text-foreground">{pending?.displayName}</strong> vai
              atualizar o tema visual, os módulos disponíveis no menu e os prompts de IA
              utilizados pela plataforma.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
