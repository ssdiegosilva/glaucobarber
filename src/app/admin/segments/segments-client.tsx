"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Scissors,
  Sparkles,
  Star,
  Target,
  Store,
  Pencil,
  Loader2,
  CheckCircle2,
  XCircle,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Scissors,
  Sparkles,
  Star,
  Target,
  Store,
};

interface SegmentRow {
  id: string;
  key: string;
  displayName: string;
  tenantLabel: string;
  icon: string | null;
  colorPrimary: string;
  active: boolean;
  sortOrder: number;
  hasAiConfig: boolean;
  barbershopCount: number;
}

export function SegmentsClient({ segments }: { segments: SegmentRow[] }) {
  const router = useRouter();
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<string | null>(null);

  async function handleSeed() {
    setSeeding(true);
    setSeedResult(null);
    const res = await fetch("/api/admin/segments/seed", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSeedResult(`Erro: ${data.error ?? "falha ao executar seed"}`);
    } else {
      setSeedResult(`${data.created ?? 0} criados, ${data.updated ?? 0} atualizados`);
    }
    setSeeding(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding}>
            {seeding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Seed padrão
          </Button>
          {seedResult && (
            <span className="text-xs text-emerald-400">{seedResult}</span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-800/50">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Segmento</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Chave</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Cor</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">IA</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Estabelecimentos</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {segments.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  <Layers className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p>Nenhum segmento cadastrado. Clique em &quot;Seed padrão&quot; para criar os 5 segmentos iniciais.</p>
                </td>
              </tr>
            )}
            {segments.map((seg) => {
              const IconComponent = seg.icon ? (ICON_MAP[seg.icon] ?? Store) : Store;
              return (
                <tr key={seg.id} className="hover:bg-surface-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="flex h-7 w-7 items-center justify-center rounded-lg border shrink-0"
                        style={{
                          backgroundColor: `hsl(${seg.colorPrimary} / 0.15)`,
                          borderColor: `hsl(${seg.colorPrimary} / 0.3)`,
                        }}
                      >
                        <IconComponent
                          className="h-3.5 w-3.5"
                          style={{ color: `hsl(${seg.colorPrimary})` }}
                        />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{seg.displayName}</p>
                        <p className="text-xs text-muted-foreground">{seg.tenantLabel}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-xs bg-surface-700 px-1.5 py-0.5 rounded text-muted-foreground">
                      {seg.key}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-4 w-4 rounded-full border border-border"
                        style={{ backgroundColor: `hsl(${seg.colorPrimary})` }}
                      />
                      <span className="text-xs text-muted-foreground font-mono">
                        {seg.colorPrimary}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {seg.hasAiConfig ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" /> Configurado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                        <XCircle className="h-3 w-3" /> Pendente
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-foreground">
                      {seg.barbershopCount}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                        seg.active
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-surface-700 text-muted-foreground"
                      )}
                    >
                      {seg.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/segments/${seg.id}`}>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
