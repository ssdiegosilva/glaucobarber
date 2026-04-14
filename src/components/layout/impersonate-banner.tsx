"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShieldAlert, X, Loader2 } from "lucide-react";

export function ImpersonateBanner({ barbershopName }: { barbershopName: string | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function stopImpersonating() {
    setLoading(true);
    await fetch("/api/admin/impersonate", { method: "DELETE" });
    router.push("/admin/barbershops");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-amber-500/15 border-b border-amber-500/30 px-4 py-2">
      <div className="flex items-center gap-2 text-amber-400 text-sm">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <span>
          Modo admin — visualizando como{" "}
          <strong className="text-amber-300">{barbershopName ?? "estabelecimento"}</strong>
        </span>
      </div>
      <button
        onClick={stopImpersonating}
        disabled={loading}
        className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-200 transition-colors disabled:opacity-50"
      >
        {loading
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <X className="h-3.5 w-3.5" />
        }
        Sair
      </button>
    </div>
  );
}
