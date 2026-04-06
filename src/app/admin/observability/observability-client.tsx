"use client";

import { useState, useMemo } from "react";
import {
  AlertTriangle,
  RefreshCw,
  MessageCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type ErrorSource = "cron" | "sync" | "whatsapp";

type ErrorEvent = {
  id:        string;
  source:    ErrorSource;
  title:     string;
  detail:    string | null;
  context:   string | null;
  shop:      string | null;
  timestamp: string;
};

type Summary = {
  cron24h:     number;
  sync24h:     number;
  whatsapp24h: number;
  cron7d:      number;
  sync7d:      number;
  whatsapp7d:  number;
};

const SOURCE_META: Record<ErrorSource, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  cron:      { label: "Cron",      icon: Clock,          color: "yellow"  },
  sync:      { label: "Sync",      icon: RefreshCw,      color: "blue"    },
  whatsapp:  { label: "WhatsApp",  icon: MessageCircle,  color: "green"   },
};

function formatTs(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day:    "2-digit",
    month:  "2-digit",
    hour:   "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatAgo(iso: string) {
  const diff  = Date.now() - new Date(iso).getTime();
  const secs  = Math.floor(diff / 1000);
  const mins  = Math.floor(secs  / 60);
  const hours = Math.floor(mins  / 60);
  const days  = Math.floor(hours / 24);
  if (days  > 0) return `há ${days}d`;
  if (hours > 0) return `há ${hours}h`;
  if (mins  > 0) return `há ${mins}min`;
  return "agora mesmo";
}

function DetailBlock({ raw }: { raw: string }) {
  let pretty = raw;
  try {
    const parsed = JSON.parse(raw);
    pretty = JSON.stringify(parsed, null, 2);
  } catch { /* not json */ }

  return (
    <pre className="mt-2 rounded bg-zinc-950 border border-zinc-700 p-3 text-xs text-zinc-300 overflow-x-auto whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
      {pretty}
    </pre>
  );
}

function ErrorRow({ ev }: { ev: ErrorEvent }) {
  const [expanded, setExpanded] = useState(false);
  const meta = SOURCE_META[ev.source];
  const Icon = meta.icon;

  return (
    <div className={`border-b border-zinc-800 last:border-0 ${expanded ? "bg-zinc-800/30" : "hover:bg-zinc-800/20"} transition-colors`}>
      <button
        className="w-full text-left px-4 py-3 flex items-start gap-3"
        onClick={() => setExpanded((e) => !e)}
      >
        {/* Source icon */}
        <div className={`mt-0.5 shrink-0 p-1.5 rounded-md bg-${meta.color}-500/10`}>
          <Icon className={`w-3.5 h-3.5 text-${meta.color}-400`} />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-zinc-100 font-medium truncate">{ev.title}</span>
            {ev.shop && (
              <span className="text-xs text-zinc-500 truncate">· {ev.shop}</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {ev.context && (
              <span className="text-xs text-zinc-500">{ev.context}</span>
            )}
            <span className="text-xs text-zinc-600">{formatAgo(ev.timestamp)}</span>
          </div>
        </div>

        {/* Expand toggle */}
        <div className="shrink-0 mt-0.5">
          {ev.detail ? (
            expanded
              ? <ChevronDown className="w-4 h-4 text-zinc-500" />
              : <ChevronRight className="w-4 h-4 text-zinc-500" />
          ) : (
            <span className="w-4 h-4 block" />
          )}
        </div>

        {/* Timestamp */}
        <span className="text-xs text-zinc-600 shrink-0 mt-0.5 hidden sm:block">
          {formatTs(ev.timestamp)}
        </span>
      </button>

      {expanded && ev.detail && (
        <div className="px-4 pb-4">
          <DetailBlock raw={ev.detail} />
        </div>
      )}
    </div>
  );
}

export function ObservabilityClient({ errors, summary }: { errors: ErrorEvent[]; summary: Summary }) {
  const [q,       setQ]       = useState("");
  const [sources, setSources] = useState<Set<ErrorSource>>(new Set());

  const total7d  = summary.cron7d + summary.sync7d + summary.whatsapp7d;
  const total24h = summary.cron24h + summary.sync24h + summary.whatsapp24h;

  function toggleSource(s: ErrorSource) {
    setSources((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  const filtered = useMemo(() => {
    return errors.filter((ev) => {
      if (sources.size > 0 && !sources.has(ev.source)) return false;
      if (q) {
        const lq = q.toLowerCase();
        if (
          !ev.title.toLowerCase().includes(lq) &&
          !(ev.shop?.toLowerCase().includes(lq)) &&
          !(ev.detail?.toLowerCase().includes(lq)) &&
          !(ev.context?.toLowerCase().includes(lq))
        ) return false;
      }
      return true;
    });
  }, [errors, sources, q]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">Observabilidade</h1>
            <p className="text-sm text-zinc-400 mt-0.5">Erros da plataforma nos últimos 7 dias</p>
          </div>
          {total24h > 0 && (
            <Badge className="border-red-500/40 bg-red-500/15 text-red-400 text-xs px-3 py-1">
              <AlertTriangle className="w-3 h-3 mr-1.5" />
              {total24h} erro{total24h !== 1 ? "s" : ""} nas últimas 24h
            </Badge>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {(["cron", "sync", "whatsapp"] as ErrorSource[]).map((src) => {
            const meta = SOURCE_META[src];
            const Icon = meta.icon;
            const count24h = summary[`${src}24h` as keyof Summary];
            const count7d  = summary[`${src}7d`  as keyof Summary];
            const hasError = count24h > 0;
            return (
              <button
                key={src}
                onClick={() => toggleSource(src)}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  sources.has(src)
                    ? `border-${meta.color}-500/50 bg-${meta.color}-500/10`
                    : hasError
                    ? "border-red-500/30 bg-zinc-900"
                    : "border-zinc-800 bg-zinc-900"
                } hover:border-zinc-600`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 text-${meta.color}-400`} />
                    <span className="text-xs text-zinc-400 font-medium">{meta.label}</span>
                  </div>
                  {sources.has(src) && (
                    <X className="w-3 h-3 text-zinc-500" />
                  )}
                </div>
                <p className={`text-2xl font-bold ${hasError ? "text-red-400" : "text-white"}`}>
                  {count24h}
                </p>
                <p className="text-xs text-zinc-600 mt-0.5">24h · {count7d} em 7d</p>
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por barbearia, mensagem, tipo…"
              className="pl-9"
            />
          </div>
          {(sources.size > 0 || q) && (
            <button
              onClick={() => { setSources(new Set()); setQ(""); }}
              className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
            >
              <X className="w-3 h-3" />
              Limpar filtros
            </button>
          )}
          <span className="text-xs text-zinc-600 ml-auto">
            {filtered.length} de {total7d} erros
          </span>
        </div>

        {/* Error feed */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="px-4 py-14 text-center">
              <AlertTriangle className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">
                {total7d === 0 ? "Nenhum erro nos últimos 7 dias." : "Nenhum erro encontrado com esse filtro."}
              </p>
            </div>
          ) : (
            filtered.map((ev) => <ErrorRow key={ev.id} ev={ev} />)
          )}
        </div>
      </div>
    </div>
  );
}
