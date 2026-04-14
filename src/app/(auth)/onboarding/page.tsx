"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Scissors,
  Sparkles,
  Star,
  Target,
  Store,
  Loader2,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Map Lucide icon names to components
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
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

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gold-400" />
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNewShop = searchParams.get("new") === "true";

  const [step, setStep] = useState<0 | 1>(0);
  const [segments, setSegments] = useState<PublicSegment[]>([]);
  const [selectedSegment, setSelectedSegment] = useState<PublicSegment | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(!isNewShop);
  const [loadingSegments, setLoadingSegments] = useState(true);

  // Check if user already has a membership — unless ?new=true
  useEffect(() => {
    if (isNewShop) return;
    fetch("/api/onboarding")
      .then((r) => r.json())
      .then((data) => {
        if (data.hasMembership) {
          router.replace("/dashboard");
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [router, isNewShop]);

  // Load public segments for step 0
  useEffect(() => {
    fetch("/api/segments/public")
      .then((r) => r.json())
      .then((data: PublicSegment[]) => {
        setSegments(data);
        setLoadingSegments(false);
      })
      .catch(() => setLoadingSegments(false));
  }, []);

  function handleNameChange(value: string) {
    setName(value);
    setSlug(value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug, segmentId: selectedSegment?.id }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Erro ao criar estabelecimento.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  if (checking) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gold-400" />
      </div>
    );
  }

  // ── Step 0: Segment selection ────────────────────────────────
  if (step === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold text-foreground">Bem-vindo!</h1>
          <p className="text-sm text-muted-foreground">
            Qual é o tipo do seu negócio?
          </p>
        </div>

        {loadingSegments ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {segments.map((seg) => {
              const IconComponent = seg.icon ? (ICON_MAP[seg.icon] ?? Store) : Store;
              const isSelected = selectedSegment?.id === seg.id;

              return (
                <button
                  key={seg.id}
                  type="button"
                  onClick={() => setSelectedSegment(seg)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all",
                    isSelected
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border bg-surface-800 hover:border-primary/50 hover:bg-surface-700"
                  )}
                  style={
                    isSelected
                      ? ({ "--primary": seg.colorPrimary } as React.CSSProperties)
                      : undefined
                  }
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg",
                      isSelected ? "bg-primary/20" : "bg-muted/30"
                    )}
                    style={
                      isSelected
                        ? ({ "--primary": seg.colorPrimary } as React.CSSProperties)
                        : undefined
                    }
                  >
                    <IconComponent
                      className={cn(
                        "h-5 w-5",
                        isSelected ? "text-primary" : "text-muted-foreground"
                      )}
                      style={
                        isSelected
                          ? ({
                              "--primary": `hsl(${seg.colorPrimary})`,
                              color: `hsl(${seg.colorPrimary})`,
                            } as React.CSSProperties)
                          : undefined
                      }
                    />
                  </div>
                  <div>
                    <p
                      className={cn(
                        "text-sm font-medium",
                        isSelected ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {seg.displayName}
                    </p>
                    {seg.description && (
                      <p className="text-xs text-muted-foreground/70 mt-0.5 line-clamp-2">
                        {seg.description}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <Button
          className="w-full"
          disabled={!selectedSegment}
          onClick={() => setStep(1)}
        >
          Continuar
        </Button>
      </div>
    );
  }

  // ── Step 1: Establishment name & slug ────────────────────────
  const tenantLabel = selectedSegment?.tenantLabel ?? "estabelecimento";
  const IconComponent = selectedSegment?.icon
    ? (ICON_MAP[selectedSegment.icon] ?? Store)
    : Store;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-1 text-center">
        <div className="flex items-center justify-center mb-4">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl border"
            style={{
              backgroundColor: selectedSegment
                ? `hsl(${selectedSegment.colorPrimary} / 0.15)`
                : undefined,
              borderColor: selectedSegment
                ? `hsl(${selectedSegment.colorPrimary} / 0.3)`
                : undefined,
            }}
          >
            <IconComponent
              className="h-6 w-6"
              style={
                selectedSegment
                  ? { color: `hsl(${selectedSegment.colorPrimary})` }
                  : undefined
              }
            />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Quase lá!</h1>
        <p className="text-sm text-muted-foreground">
          Crie seu {tenantLabel} para começar
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground capitalize">
            Nome do {tenantLabel}
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder={
              selectedSegment?.key === "barbershop"
                ? "Art Shave Barbearia"
                : selectedSegment?.key === "hair_salon"
                ? "Studio Hair Salão"
                : selectedSegment?.key === "nail_studio"
                ? "Nail Art Studio"
                : "Meu Negócio"
            }
            className="w-full rounded-md border border-border bg-surface-800 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground capitalize">
            URL do {tenantLabel}
          </label>
          <div className="flex items-center rounded-md border border-border bg-surface-800 px-3 py-2.5 text-sm">
            <span className="text-muted-foreground shrink-0">glaucobarber.com/</span>
            <input
              type="text"
              required
              value={slug}
              onChange={(e) =>
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
              }
              placeholder="meu-negocio"
              className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none ml-1"
            />
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-400 rounded-md border border-red-500/20 bg-red-500/8 px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            onClick={() => setStep(0)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Button
            type="submit"
            className="flex-1"
            disabled={loading || !name || !slug}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              `Criar ${tenantLabel} e entrar`
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
