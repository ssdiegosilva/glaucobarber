"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Scissors,
  Sparkles,
  Star,
  Target,
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

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Scissors,
  Sparkles,
  Star,
  Target,
  Store,
};

interface PublicSegment {
  id: string;
  key: string;
  displayName: string;
  tenantLabel: string;
  description: string | null;
  icon: string | null;
  colorPrimary: string;
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

            return (
              <button
                key={seg.id}
                type="button"
                onClick={() => handleSelect(seg)}
                disabled={saving}
                className={cn(
                  "relative flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all",
                  isCurrent
                    ? "border-primary bg-primary/10 ring-1 ring-primary"
                    : "border-border bg-surface-800 hover:border-primary/40 hover:bg-surface-700"
                )}
                style={
                  isCurrent
                    ? ({ "--primary": seg.colorPrimary } as React.CSSProperties)
                    : undefined
                }
              >
                {isCurrent && (
                  <CheckCircle2
                    className="absolute top-2 right-2 h-3.5 w-3.5 text-primary"
                    style={{ color: `hsl(${seg.colorPrimary})` }}
                  />
                )}
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: isCurrent
                      ? `hsl(${seg.colorPrimary} / 0.2)`
                      : undefined,
                  }}
                >
                  <IconComponent
                    className="h-4 w-4"
                    style={
                      isCurrent
                        ? { color: `hsl(${seg.colorPrimary})` }
                        : { color: "hsl(var(--muted-foreground))" }
                    }
                  />
                </div>
                <span
                  className={cn(
                    "text-xs font-medium",
                    isCurrent ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {seg.displayName}
                </span>
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
